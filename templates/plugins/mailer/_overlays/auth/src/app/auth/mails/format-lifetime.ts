// "15 minutes", "1 hour", "24 hours": templates have no helpers, so the text is prepared here.
export function formatLifetime(minutes: number): string {
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    return minutes >= 60 && minutes % 60 === 0 ? plural(minutes / 60, 'hour') : plural(Math.round(minutes), 'minute');
}
