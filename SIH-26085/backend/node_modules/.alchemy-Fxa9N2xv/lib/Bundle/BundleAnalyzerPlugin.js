/**
 * Wraps rolldown's experimental bundle analyzer plugin, which emits a report
 * describing the composition of the bundle.
 *
 * The report includes:
 * - all chunks and their relationships
 * - the modules bundled into each chunk
 * - import dependencies between chunks
 * - the modules reachable from each entry point
 */
export const bundleAnalyzerPlugin = async (options = {}) => {
    // `rolldown/experimental` loads `@rolldown/binding-*` at module scope,
    // so it is imported lazily — importing this module (e.g. via the
    // `alchemy/Bundle` barrel) must never load the native binding (#562).
    const { bundleAnalyzerPlugin: rolldownBundleAnalyzerPlugin } = await import("rolldown/experimental");
    return rolldownBundleAnalyzerPlugin({
        fileName: options.fileName,
        format: options.format ?? "md",
    });
};
//# sourceMappingURL=BundleAnalyzerPlugin.js.map