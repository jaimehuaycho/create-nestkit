import * as fs from 'fs';
import * as path from 'path';

// projectName is used as a directory name, as the generated package name and interpolated into the
// `nest new` shell command, so it must never contain spaces, path separators or shell metacharacters.
const PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_LENGTH   = 214;           // npm's package name limit
const RESERVED     = new Set(['node_modules']);

// Returns an error message, or undefined when the name is acceptable.
export function validateProjectName(name: string): string | undefined {
    if (!name.trim())            return 'Project name is required.';
    if (name.length > MAX_LENGTH) return `Project name must be ${MAX_LENGTH} characters or fewer.`;
    if (RESERVED.has(name))      return `"${name}" is a reserved name.`;
    if (!PROJECT_NAME.test(name)) {
        return 'Use only letters, numbers, ".", "-" and "_", starting with a letter or number (no spaces or slashes).';
    }
    return undefined;
}

// Returns an error message when something already exists at targetDir, otherwise undefined.
export function validateTargetDir(targetDir: string): string | undefined {
    if (fs.existsSync(targetDir)) {
        return `A file or directory already exists at ${path.resolve(targetDir)}. Choose another name or remove it first.`;
    }
    return undefined;
}
