import { toSeconds } from "../../Util/Duration.js";
// At reconcile time the engine has already resolved Input/resource refs to
// plain ARN strings.
const resolveTargetGroupArn = (ref) => ref;
/**
 * Serialize a list of {@link ListenerAction} into the wire `Action[]` shape AWS
 * expects, assigning `Order` so authentication actions run before the terminal
 * action. Shared by both Listener default-actions and ListenerRule actions.
 */
export const serializeActions = (actions) => actions.map((action, index) => {
    const Order = index + 1;
    switch (action.type) {
        case "forward":
            return {
                Type: "forward",
                Order,
                ForwardConfig: {
                    TargetGroups: action.targetGroups.map((t) => ({
                        TargetGroupArn: resolveTargetGroupArn(t.targetGroupArn),
                        Weight: t.weight,
                    })),
                    TargetGroupStickinessConfig: action.stickiness
                        ? {
                            Enabled: action.stickiness.enabled,
                            DurationSeconds: toSeconds(action.stickiness.duration),
                        }
                        : undefined,
                },
                // For a single, unweighted target group, AWS also accepts the legacy
                // top-level TargetGroupArn; sending only ForwardConfig is canonical.
                TargetGroupArn: action.targetGroups.length === 1 &&
                    action.targetGroups[0].weight === undefined
                    ? resolveTargetGroupArn(action.targetGroups[0].targetGroupArn)
                    : undefined,
            };
        case "redirect":
            return {
                Type: "redirect",
                Order,
                RedirectConfig: {
                    StatusCode: action.statusCode,
                    Protocol: action.protocol,
                    Port: action.port,
                    Host: action.host,
                    Path: action.path,
                    Query: action.query,
                },
            };
        case "fixedResponse":
            return {
                Type: "fixed-response",
                Order,
                FixedResponseConfig: {
                    StatusCode: action.statusCode,
                    ContentType: action.contentType,
                    MessageBody: action.messageBody,
                },
            };
        case "authenticateOidc":
            return {
                Type: "authenticate-oidc",
                Order,
                AuthenticateOidcConfig: {
                    Issuer: action.issuer,
                    AuthorizationEndpoint: action.authorizationEndpoint,
                    TokenEndpoint: action.tokenEndpoint,
                    UserInfoEndpoint: action.userInfoEndpoint,
                    ClientId: action.clientId,
                    // Redacted end-to-end: distilled's AuthenticateOidcActionConfig
                    // marks ClientSecret sensitive, so the Redacted passes straight
                    // through and is only unwrapped by the wire serializer.
                    ClientSecret: action.clientSecret,
                    Scope: action.scope,
                    SessionCookieName: action.sessionCookieName,
                    SessionTimeout: toSeconds(action.sessionTimeout),
                    OnUnauthenticatedRequest: action.onUnauthenticatedRequest,
                    UseExistingClientSecret: action.useExistingClientSecret,
                },
            };
        case "authenticateCognito":
            return {
                Type: "authenticate-cognito",
                Order,
                AuthenticateCognitoConfig: {
                    UserPoolArn: action.userPoolArn,
                    UserPoolClientId: action.userPoolClientId,
                    UserPoolDomain: action.userPoolDomain,
                    Scope: action.scope,
                    SessionCookieName: action.sessionCookieName,
                    SessionTimeout: toSeconds(action.sessionTimeout),
                    OnUnauthenticatedRequest: action.onUnauthenticatedRequest,
                },
            };
    }
});
/**
 * Serialize a list of {@link ListenerRuleCondition} into the wire
 * `RuleCondition[]` shape AWS expects.
 */
export const serializeConditions = (conditions) => conditions.flatMap((condition) => {
    const out = [];
    if (condition.hostHeader) {
        out.push({
            Field: "host-header",
            HostHeaderConfig: {
                Values: condition.hostHeader.values,
                RegexValues: condition.hostHeader.regexValues,
            },
        });
    }
    if (condition.pathPattern) {
        out.push({
            Field: "path-pattern",
            PathPatternConfig: {
                Values: condition.pathPattern.values,
                RegexValues: condition.pathPattern.regexValues,
            },
        });
    }
    if (condition.httpHeader) {
        out.push({
            Field: "http-header",
            HttpHeaderConfig: {
                HttpHeaderName: condition.httpHeader.name,
                Values: condition.httpHeader.values,
                RegexValues: condition.httpHeader.regexValues,
            },
        });
    }
    if (condition.queryString) {
        out.push({
            Field: "query-string",
            QueryStringConfig: {
                Values: condition.queryString.values.map((v) => ({
                    Key: v.key,
                    Value: v.value,
                })),
            },
        });
    }
    if (condition.httpRequestMethod) {
        out.push({
            Field: "http-request-method",
            HttpRequestMethodConfig: {
                Values: condition.httpRequestMethod.values,
            },
        });
    }
    if (condition.sourceIp) {
        out.push({
            Field: "source-ip",
            SourceIpConfig: { Values: condition.sourceIp.values },
        });
    }
    return out;
});
//# sourceMappingURL=common.js.map