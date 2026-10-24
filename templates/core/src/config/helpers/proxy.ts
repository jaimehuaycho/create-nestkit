/**
 * Reads TRUST_PROXY for Express's `trust proxy` setting. Behind a reverse proxy or load balancer the client's IP arrives in
 * X-Forwarded-For; without this, every client looks like the proxy (one shared rate-limit bucket, wrong IPs in logs).
 *   unset / empty  -> not behind a proxy: X-Forwarded-For is ignored (it can be forged by any client)
 *   1, 2, ...      -> number of proxies between the client and the app (the usual, safe choice)
 *   loopback, ...  -> any other value Express accepts (a name, a subnet or a comma-separated list of addresses)
 * Avoid `true`: it trusts every hop, so a client can send a fake X-Forwarded-For and dodge the rate limit.
 */
export function parseTrustProxy(value: string | undefined): number | string | undefined {
    const v = value?.trim();
    if (!v) return undefined;
    return /^\d+$/.test(v) ? Number(v) : v;
}
