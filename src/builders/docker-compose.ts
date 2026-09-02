interface DbDriver {
    composeService?: string;
    composeVolume?:  string;
    appDependsOn?:   string;
}

export function buildDockerCompose(resolvedPlugins: string[], driver: DbDriver): string {
    const hasDb = resolvedPlugins.includes('database') && driver.composeService;

    const dependsOnBlock = hasDb
        ? `    depends_on:\n      ${driver.appDependsOn}\n`
        : '';

    const extraServices = hasDb ? `\n${driver.composeService}` : '';
    const volumes       = hasDb && driver.composeVolume
        ? `\nvolumes:\n${driver.composeVolume}\n`
        : '';

    return [
        `services:`,
        `  app:`,
        `    build: .`,
        `    ports:`,
        `      - "\${PORT:-3000}:3000"`,
        `    env_file: .env`,
        `    restart: unless-stopped`,
        dependsOnBlock.trimEnd() || null,
        extraServices || null,
        volumes || null,
    ].filter(l => l !== null && l !== '').join('\n') + '\n';
}
