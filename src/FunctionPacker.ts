import * as vscode from 'vscode';
import * as Utils from './Utils';
import * as Definations from './Definations';
import * as path from 'path';
import * as fs from 'fs'

namespace FunctionPacker {
    const _PackedMap = new Map<string, Boolean>();
    // const recorded: string[] = [];
    const _Snippets: vscode.CompletionItem[] = [];
    const _FunctionMap: Definations.Function[] = [];
    const _QuickInclude: vscode.CompletionItem[] = [];

    export function GetPackedCount() {
        return _PackedMap.size;
    }
    export function GetFuncCount() {
        return _Snippets.length;
    }

    export async function Launch() {
        let result = vscode.workspace.getConfiguration().get<string[]>('shadingwithunity.alwaysIncludes');
        if (result == null) {
            result = [
                'Packages/com.unity.render-pipelines.core/ShaderLibrary/SpaceTransforms.hlsl',
                'Packages/com.unity.render-pipelines.universal/ShaderLibrary/GlobalIllumination.hlsl',
                'Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl',
                "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl",
                "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareNormalsTexture.hlsl",
            ];
        }
        for (let i = 0; i < result.length; i++) {
            let alwaysIncudePath = result[i];
            let includePath = Utils.GetAbsoluteIncludePath('', alwaysIncudePath);
            if (!includePath) continue;
            // let doc = await vscode.workspace.openTextDocument(vscode.Uri.file(includePath));
            let doc = await SaveOpenDoc(vscode.Uri.file(includePath));
            await PackDocument(doc);
        }

        vscode.workspace.findFiles('**/Library/PackageCache/com.unity.render-pipelines.core*/**/*.hlsl', "**/Editor/**").then((uris) => {
            // console.log(uris);
            for (let index = 0; index < uris.length; index++) {
                const element = uris[index];
                let sourcePath = element.fsPath;
                let a = sourcePath.split('com.unity.render-pipelines.core')[1];
                let b = a.indexOf('/');
                let c = a.substring(b);
                let fileName = path.basename(sourcePath);
                let dir = path.dirname(sourcePath);
                // console.log(c + '/' + fileName);
                let item = new vscode.CompletionItem("include " + fileName, vscode.CompletionItemKind.Snippet);
                item.insertText = `include \"Packages/com.unity.render-pipelines.core${c}\"`;
                _PushFunctionItem(item);

            }
        });

        vscode.workspace.findFiles('**/Library/PackageCache/com.unity.render-pipelines.universal*/**/*.hlsl', "**/Editor/**").then((uris) => {
            // console.log(uris);
            for (let index = 0; index < uris.length; index++) {
                const element = uris[index];
                let sourcePath = element.fsPath;
                let a = sourcePath.split('com.unity.render-pipelines.universal')[1];
                let b = a.indexOf('/');
                let c = a.substring(b);
                let fileName = path.basename(sourcePath);
                let dir = path.dirname(sourcePath);
                // console.log(c + '/' + fileName);
                let item = new vscode.CompletionItem("include " + fileName, vscode.CompletionItemKind.Snippet);
                item.insertText = `include \"Packages/com.unity.render-pipelines.universal${c}\"`;
                _PushFunctionItem(item);

            }
        });
    }

    export function _PushFunctionItem(item: vscode.CompletionItem) {
        // console.log(item);
        _QuickInclude.push(item);
    }

    export async function SaveOpenDoc(uri: vscode.Uri) {
        if (fs.existsSync(uri.fsPath)) {
            return await vscode.workspace.openTextDocument(uri);
        } else {
            return null;
        }
    }

    export function IsPackableDocument(doc: vscode.TextDocument | null) {
        if (doc == null) return false;
        if (doc.isUntitled) return false;
        if (doc.languageId != 'shaderlab' && doc.languageId != 'hlsl') return false;
        return true;
    }

    export async function PackDocument(doc: vscode.TextDocument | null) {
        // console.log()
        if (doc == null) return;
        if (!IsPackableDocument(doc)) return;

        const docPath = doc.fileName;
        if (_PackedMap.has(docPath)) return;
        _PackedMap.set(docPath, true);

        // 暂时处理不了
        if (path.basename(doc.uri.fsPath) == "Macros.hlsl") return;

        const workDir = path.dirname(docPath);


        let isCustomFile = Utils.IsDodumentInAssets(doc);
        let includeFiles = [];

        console.log("收录文件: " + docPath);
        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i);
            const lineTrimed = line.text.trim();

            if (Utils.IsFunction(lineTrimed)) {
                await FunctionPacker.PackFunc(docPath, lineTrimed, i);
            }

            if (!isCustomFile) continue;
            let includeString = Utils.GetIncludeString(lineTrimed);
            if (!includeString) continue;
            let includePath = Utils.GetAbsoluteIncludePath(workDir, includeString);
            if (includePath == null || includePath == '') continue;
            includeFiles.push(includePath);
        }

        for (let includeFile of includeFiles) {
            console.log("收录Include: " + includeFile);
            let includeDoc = await SaveOpenDoc(vscode.Uri.file(includeFile))
            await PackDocument(includeDoc);
        }
    }



    export async function PackFunc(filePath: string, lineTrimed: string, lineIndex: number) {
        let func = Utils.UnpackLineTrimed(lineTrimed, lineIndex);
        if (func == null) return;
        func.filePath = filePath;
        console.log(`\t收录方法[${func.function}]`);
        let funcItem = func.getCompletionItem();
        if (funcItem != null) {
            // console.log(`\t\t收录Item[${funcItem}]`);
            _FunctionMap.push(func);
            _Snippets.push(funcItem);
        }
    }

    export function GetMatchedFunc(word: string) {
        let ret = [];
        for (let i = 0; i < _FunctionMap.length; i++) {
            if (_FunctionMap[i].functionName.startsWith(word)) {
                ret.push(_FunctionMap[i]);
            }
        }
        return ret;
    }

    export function provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

        const fileName = document.fileName;
        const workDir = path.dirname(fileName);
        const wordRange = document.getWordRangeAtPosition(position);
        const word = document.getText(wordRange);
        const line = document.lineAt(position);
        let firstLetter = word[0];
        // console.log(firstLetter);
        const lineTrimed = line.text.trim();


        // // 检查光标是否在函数调用内部
        // const editor = vscode.window.activeTextEditor;
        // if (!editor) return;


        // const editCall = Utils.isCursorInFunctionCall(document, position);
        // console.log(editCall);
        // if (editCall) {
        //     let funcName = Utils.getFunctionNameAtCursor(document, position);
        //     console.log(funcName);
        //     if (funcName === 'TransformObjectToWorldNormal') {
        //         let ret = [];
        //         ret.push(
        //             new vscode.CompletionItem('', vscode.CompletionItemKind.Variable),
        //             new vscode.CompletionItem('normalMatrix', vscode.CompletionItemKind.Variable)
        //         );
        //         return ret;
        //     }
        // }


        if (lineTrimed.startsWith("#i")) {
            return _QuickInclude;
        }
        if (lineTrimed.startsWith("#")) return null;

        if (firstLetter == '_') return _Snippets;

        return null;
    }

    export const Provider = { provideCompletionItems };

}
export = FunctionPacker;