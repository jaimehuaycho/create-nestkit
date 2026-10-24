// src/config/app-name.ts: the name of the generated application. It titles Swagger and the startup banner, and (with Auth) identifies the
// API in the access tokens and in the authenticator app's list. The project name is validated (validateProjectName) before it gets here.
export const APP_NAME_PATH = 'src/config/app-name.ts';

export function buildAppName(projectName: string): string {
    return [
        `// The name of this application. It titles the API docs and the startup banner, and with Auth it identifies the API in the access`,
        `// tokens (iss and aud) and in the authenticator app's list. The generator writes your project's name here.`,
        `// Change it only if you really need another identity.`,
        `export const APP_NAME = '${projectName}';`,
        ``,
    ].join('\n');
}
