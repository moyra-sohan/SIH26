import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { inspectArtifactFile, inspectVerifiedFile, readArtifactFile, } from "./Internal/ArtifactFile.js";
import { isArchivedRegularFile, readDirectoryEntriesSecure, writeCompressedArchiveSecure, } from "./Internal/ArchivePlatform.js";
export const COMPUTE_MANIFEST_VERSION = "1";
const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 50_000;
const MAX_COMPRESSED_BYTES = 256 * 1024 * 1024;
const ALWAYS_IGNORED_PATTERNS = [
    ".git",
    "**/.git",
    ".alchemy",
    "**/.alchemy",
    ".env",
    "**/.env",
    ".env.*",
    "**/.env.*",
    ".envrc",
    "**/.envrc",
    ".npmrc",
    "**/.npmrc",
    ".yarnrc*",
    "**/.yarnrc*",
    ".netrc",
    "**/.netrc",
    ".pypirc",
    "**/.pypirc",
    ".aws",
    "**/.aws",
    ".ssh",
    "**/.ssh",
];
/**
 * Create the `tar.gz` artifact consumed by Prisma Compute.
 *
 * Files are added under the `bundle/` prefix, with a synthetic
 * `compute.manifest.json` at the archive root. Tar construction and gzip
 * compression stream through a private temporary file, so the uncompressed
 * artifact is never retained in memory.
 */
export function createComputeArchive(options) {
    const effect = createComputeArchiveFile(options);
    if (options.output === "file")
        return effect;
    return Effect.flatMap(effect, (artifact) => readArtifactFile(artifact).pipe(Effect.ensuring(artifact.cleanup)));
}
const createComputeArchiveFile = Effect.fn(function* (options) {
    const { directory, entrypoint, ignore = [], maxUncompressedBytes = MAX_UNCOMPRESSED_BYTES, maxFileBytes = MAX_FILE_BYTES, maxEntries = MAX_ENTRIES, } = options;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = path.resolve(directory);
    const realRoot = yield* fs.realPath(root);
    const normalizedEntrypoint = yield* normalizeEntrypoint(entrypoint);
    const validated = yield* Effect.try({
        try: () => ({
            ignore: [...ALWAYS_IGNORED_PATTERNS, ...ignore].map(compileIgnorePattern),
            maxUncompressedBytes: boundedLimit("maxUncompressedBytes", maxUncompressedBytes, MAX_UNCOMPRESSED_BYTES),
            maxFileBytes: boundedLimit("maxFileBytes", maxFileBytes, MAX_FILE_BYTES),
            maxEntries: boundedLimit("maxEntries", maxEntries, MAX_ENTRIES),
        }),
        catch: (error) => error instanceof Error ? error : new Error(String(error)),
    });
    const budget = {
        ...validated,
        bytes: 0,
        entries: 0,
    };
    if (budget.maxFileBytes > budget.maxUncompressedBytes) {
        return yield* Effect.fail(new Error("maxFileBytes must not exceed maxUncompressedBytes"));
    }
    if (isIgnored(normalizedEntrypoint, budget.ignore)) {
        return yield* Effect.fail(new Error(`Entrypoint is excluded from the compute artifact: ${normalizedEntrypoint}`));
    }
    const resolvedEntrypoint = yield* resolvePathWithinRoot(realRoot, path.join(realRoot, normalizedEntrypoint));
    const entrypointStat = yield* fs.stat(resolvedEntrypoint);
    if (entrypointStat.type !== "File") {
        return yield* Effect.fail(new Error(`Entrypoint must be a file in compute artifact: ${normalizedEntrypoint}`));
    }
    const entries = [];
    yield* addDirectoryEntries(entries, realRoot, realRoot, "bundle", "", budget);
    const entrypointArchiveName = `bundle/${normalizedEntrypoint}`;
    if (!isArchivedRegularFile(entries, entrypointArchiveName)) {
        return yield* Effect.fail(new Error(`Entrypoint not found in compute artifact: ${normalizedEntrypoint}`));
    }
    const manifest = new TextEncoder().encode(JSON.stringify({
        manifestVersion: COMPUTE_MANIFEST_VERSION,
        entrypoint: entrypointArchiveName,
    }, null, 2));
    const archivePath = yield* fs.makeTempFile({
        prefix: "alchemy-prisma-compute-",
        suffix: ".tar.gz",
    });
    const cleanup = fs
        .remove(archivePath, { force: true })
        .pipe(Effect.catch(() => Effect.void));
    yield* writeCompressedArchiveSecure(archivePath, entries, manifest, MAX_COMPRESSED_BYTES).pipe(Effect.catch((error) => cleanup.pipe(Effect.andThen(Effect.fail(error)))));
    return yield* inspectArtifactFile(archivePath, MAX_COMPRESSED_BYTES, {
        cleanup,
        description: "Prisma compute archive",
    }).pipe(Effect.catch((error) => cleanup.pipe(Effect.andThen(Effect.fail(error)))));
});
const addDirectoryEntries = Effect.fn(function* (entries, realRoot, directory, tarPrefix, relativePrefix, budget) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directoryResult = yield* readDirectoryEntriesSecure({
        directory,
        relativePrefix,
        ignore: budget.ignore,
        entriesAlreadyObserved: budget.entries,
        maxEntries: budget.maxEntries,
    });
    budget.entries += directoryResult.observedEntries;
    for (const entry of directoryResult.entries) {
        const name = entry.name;
        const relativeName = relativePrefix ? `${relativePrefix}/${name}` : name;
        const filePath = path.join(directory, name);
        const tarName = `${tarPrefix}/${name}`;
        if (entry.type === "SymbolicLink") {
            const symlinkTarget = yield* fs.readLink(filePath);
            const linkname = yield* resolveArchiveSymlinkTarget(realRoot, filePath, symlinkTarget);
            entries.push({
                name: tarName,
                mode: 0o777,
                type: "symlink",
                linkname,
            });
            continue;
        }
        if (entry.type === "Directory") {
            const realDirectory = yield* resolvePathWithinRoot(realRoot, filePath);
            yield* addDirectoryEntries(entries, realRoot, realDirectory, tarName, relativeName, budget);
            continue;
        }
        if (entry.type !== "File") {
            return yield* Effect.fail(new Error(`Unsupported filesystem entry in compute artifact: ${relativeName}`));
        }
        const verified = yield* inspectVerifiedFile(filePath, budget.maxFileBytes, {
            allowEmpty: true,
            description: `Compute artifact file '${relativeName}'`,
        });
        yield* ensureResolvedPathWithinRoot(realRoot, verified.path);
        if (budget.bytes + verified.size > budget.maxUncompressedBytes) {
            return yield* Effect.fail(new Error(`Compute artifact exceeds the ${budget.maxUncompressedBytes} byte uncompressed safety limit. Narrow the artifact directory or add ignore patterns.`));
        }
        budget.bytes += verified.size;
        entries.push({
            name: tarName,
            mode: verified.mode & 0o777,
            type: "file",
            file: verified,
        });
    }
});
export const normalizeEntrypoint = (entrypoint) => Effect.gen(function* () {
    const normalized = entrypoint.replaceAll("\\", "/");
    if (normalized.trim().length === 0) {
        return yield* Effect.fail(new Error("entrypoint must be non-empty"));
    }
    if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
        return yield* Effect.fail(new Error("entrypoint must be relative"));
    }
    const parts = normalized.split("/").filter((part) => part !== ".");
    if (parts.some((part) => part === ".." || part.length === 0)) {
        return yield* Effect.fail(new Error("entrypoint must not contain empty or parent segments"));
    }
    return parts.join("/");
});
const resolvePathWithinRoot = Effect.fn(function* (realRoot, candidate) {
    const fs = yield* FileSystem.FileSystem;
    const realCandidate = yield* fs.realPath(candidate);
    yield* ensureResolvedPathWithinRoot(realRoot, realCandidate);
    return realCandidate;
});
const ensureResolvedPathWithinRoot = Effect.fn(function* (realRoot, resolvedCandidate) {
    const path = yield* Path.Path;
    const relative = path.relative(realRoot, resolvedCandidate);
    if (relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)) {
        return yield* Effect.fail(new Error(`Archive path escapes compute artifact root: ${resolvedCandidate}`));
    }
});
const resolveArchiveSymlinkTarget = Effect.fn(function* (realRoot, symlinkPath, target) {
    const path = yield* Path.Path;
    if (path.sep === "/" && target.includes("\\")) {
        return yield* Effect.fail(new Error(`Archive symlink target contains an unsupported backslash: ${target}`));
    }
    const symlinkDir = path.dirname(symlinkPath);
    const targetPath = path.isAbsolute(target)
        ? target
        : path.resolve(symlinkDir, target);
    const realTarget = yield* resolvePathWithinRoot(realRoot, targetPath);
    if (!path.isAbsolute(target))
        return target.replaceAll("\\", "/");
    const realSymlinkDir = yield* resolvePathWithinRoot(realRoot, symlinkDir);
    const relative = path.relative(realSymlinkDir, realTarget);
    return (relative.length === 0 ? "." : relative).replaceAll("\\", "/");
});
const boundedLimit = (name, value, hardLimit) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer`);
    }
    if (value > hardLimit) {
        throw new Error(`${name} must not exceed the hard limit of ${hardLimit}`);
    }
    return value;
};
const compileIgnorePattern = (input) => {
    const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "");
    if (normalized.length === 0 ||
        normalized.startsWith("!") ||
        normalized.startsWith("/") ||
        /^[a-zA-Z]:\//.test(normalized) ||
        normalized.split("/").some((segment) => segment === "..")) {
        throw new Error(`Invalid compute archive ignore pattern: ${input}`);
    }
    const escaped = normalized
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replaceAll("**", "\0")
        .replaceAll("*", "[^/]*")
        .replaceAll("\0", ".*");
    return new RegExp(`^${escaped}(?:/.*)?$`);
};
const isIgnored = (relativeName, patterns) => patterns.some((pattern) => pattern.test(relativeName));
//# sourceMappingURL=ComputeArchive.js.map