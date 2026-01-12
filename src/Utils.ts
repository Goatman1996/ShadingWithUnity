
import * as vscode from "vscode";
import * as Definations from './Definations';
import * as path from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';

namespace Utils {
    const withLog = false;
    export async function TryAsync<T>(promise: Promise<T>) {
        try {
            const result = await promise;
            return result;
        } catch (err) {
            console.log(err);
        }
    }

    let workspaceFolder: string | undefined;
    export function GetWorkSpaceFolder() {
        if (!workspaceFolder) {
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
        }
        return workspaceFolder;
    }

    export function IsDodumentInPackage(doc: vscode.TextDocument) {
        if (doc.fileName.includes("Library/PackageCache")) return true;
        return false;
    }

    export async function findFilesIgnoringExclude(coreInc: string, coreExc: string) {
        // let uris: string[] = [];
        // return uris;
        // 获取工作区根目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        // 使用 glob 模块，它会忽略 VS Code 的 exclude 设置
        const options: fg.Options = {
            cwd: rootPath,
            absolute: true,
            onlyFiles: true,
        };

        if (true) {
            options.ignore = [coreExc];
        }

        let uris: string[] = [];
        try {
            const files = await fg(coreInc, options);
            for (const file of files) {
                uris.push(file);
            }
            // vscode.window.showInformationMessage(`${uris.length} files found (ignoring files.exclude)`);

            // 使用 uris 进行后续操作
            return uris;
        } catch (error) {
            vscode.window.showErrorMessage(`Error finding files: ${error}`);
        }
    }

    export function IsDodumentInAssets(doc: vscode.TextDocument) {
        if (doc.fileName.includes("/Assets/")) return true;
        return false;
    }

    export var packageFolders: Map<string, string>;
    export async function LaunchAsync() {
        await PreparePackageFoldersAsync();
    }

    async function PreparePackageFoldersAsync() {
        Utils.packageFolders = new Map<string, string>();

        const packageCachePath = Utils.GetWorkSpaceFolder() + "/Library/PackageCache";
        // Warning: Closing directory handle on garbage collection
        const packageCacheDir = await TryAsync(fs.promises.opendir(packageCachePath));
        if (packageCacheDir == null) {
            vscode.window.showErrorMessage("PackageCache not found");
            return;
        }

        const packagesPrefix = 'com.unity.render-pipelines';

        const children = await TryAsync<string[]>(fs.promises.readdir(packageCachePath));
        if (children == null) {
            vscode.window.showErrorMessage("PackageCache not found");
            return;
        }
        for (const child of children) {
            if (child.startsWith(packagesPrefix)) {
                Utils.packageFolders.set("Packages/" + child.split('@')[0], 'Library/PackageCache/' + child);
            }
        }
        if (withLog) console.log(Utils.packageFolders);
        packageCacheDir.closeSync();

    }

    export function IsFunction(lineTrimed: string) {
        if (lineTrimed.startsWith("if")) return false;
        if (lineTrimed.startsWith("else")) return false;
        if (lineTrimed.startsWith("return ")) return false;
        const regex = /^\s*(\w+[\w\s\*]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:\:([^;{]+))?/;
        return regex.test(lineTrimed);
    }
    export function UnpackLineTrimed(lineTrimed: string, lineIndex: number) {
        const regex = /\w+\s+(\w+)\s*\(/;
        const match = lineTrimed.match(regex);
        if (match) {
            let ret = new Definations.Function();
            ret.functionName = match[1];
            ret.function = lineTrimed;
            ret.lineIndex = lineIndex;
            return ret;
        }
        return null;
    }

    export function GetIncludeString(lineTrimed: string) {
        if (lineTrimed.startsWith("/")) return null;
        const regex = /#include\s+"([^"]+)"/;
        const match = lineTrimed.match(regex);
        if (match) {
            return match[1];
        }
        return null;
    }

    export function GetAbsoluteIncludePath(curDir: string, includeFile: string) {
        if (packageFolders == null) return;

        // 如果是相对路径，解析为完整路径
        if (includeFile.startsWith("./") || includeFile.startsWith("../")) {
            return path.resolve(curDir, includeFile);
        }

        if (includeFile.startsWith("Packages/")) {
            const root = GetWorkSpaceFolder();
            var url = includeFile;
            packageFolders.forEach((v, k) => {
                if (url.includes(k)) {
                    url = includeFile.replace(k, v);
                }
            });

            return path.resolve(root ?? "", url);
        }

        // 如果是绝对路径，直接返回
        if (path.isAbsolute(includeFile)) {
            return includeFile;
        }

        // 如果是文件名，直接拼接
        return path.join(curDir, includeFile);
    }

    export function isCursorInFunctionCall(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const line = document.lineAt(position.line);
        const textBeforeCursor = line.text.substring(0, position.character);
        const textAfterCursor = line.text.substring(position.character);

        // 1. 查找最近的左括号
        const lastOpenParen = textBeforeCursor.lastIndexOf('(');
        if (lastOpenParen === -1) {
            return false; // 没有左括号
        }

        // 2. 检查左括号和光标之间是否有右括号
        const textBetween = textBeforeCursor.substring(lastOpenParen + 1);
        const closeParenBeforeCursor = textBetween.indexOf(')');
        if (closeParenBeforeCursor !== -1) {
            return false; // 已有右括号，光标在括号外
        }

        // 3. 检查左括号前是否是函数名
        const beforeOpenParen = textBeforeCursor.substring(0, lastOpenParen);
        const functionNameMatch = beforeOpenParen.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);

        return !!functionNameMatch;
    }

    export function getFunctionNameAtCursor(
        document: vscode.TextDocument,
        position: vscode.Position
    ): string | null {
        const line = document.lineAt(position.line);
        const textBeforeCursor = line.text.substring(0, position.character);

        // 查找最近的左括号
        const lastOpenParen = textBeforeCursor.lastIndexOf('(');
        if (lastOpenParen === -1) {
            return null;
        }

        // 提取函数名
        const beforeOpenParen = textBeforeCursor.substring(0, lastOpenParen);
        const functionNameMatch = beforeOpenParen.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);

        return functionNameMatch ? functionNameMatch[1] : null;
    }
}
export = Utils;