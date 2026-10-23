interface DbDriver {
    composeService?: string;
    composeVolume?:  string;
    appDependsOn?:   string;
    containerPort?:  number;
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

    // Inside Docker the app listens on 3000 (EXPOSE, the healthcheck and the port mapping assume it) and reaches the database as the `db`
    // service. These override the host-side values in .env (your own PORT, DB_HOST=localhost, the DB_PORT you published): without them the
    // container could not connect to its database.
    const environmentBlock = [
        `    # Overrides .env inside the container (the host-side PORT, DB_HOST and DB_PORT do not apply here).`,
        `    environment:`,
        `      PORT: 3000`,
        hasDb && driver.containerPort ? `      DB_HOST: db\n      DB_PORT: ${driver.containerPort}` : null,
    ].filter(l => l !== null).join('\n');

    return [
        `services:`,
        `  app:`,
        `    build: .`,
        `    ports:`,
        `      - "\${PORT:-3000}:3000"`,
        `    env_file: .env`,
        environmentBlock,
        `    restart: unless-stopped`,
        dependsOnBlock.trimEnd() || null,
        extraServices || null,
        volumes || null,
    ].filter(l => l !== null && l !== '').join('\n') + '\n';
}
