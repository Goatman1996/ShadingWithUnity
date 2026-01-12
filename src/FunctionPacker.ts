import * as vscode from 'vscode';
import * as Utils from './Utils';
import * as Definations from './Definations';
import * as path from 'path';
import * as fs from 'fs'

namespace FunctionPacker {
    const withLog = false;
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
    export function GetInCludeCount() {
        return _QuickInclude.length;
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
            let doc = await SaveOpenDoc(vscode.Uri.file(includePath));
            await PackDocument(doc);
        }
        let coreInc = '**/Library/PackageCache/com.unity.render-pipelines.core*/**/*.hlsl';
        let coreExc = "**/Editor/**";
        let coreFiles = await Utils.findFilesIgnoringExclude(coreInc, coreExc);
        if (coreFiles != null) {
            for (let index = 0; index < coreFiles.length; index++) {
                const element = coreFiles[index];
                CollectInclude(vscode.Uri.file(element), 'com.unity.render-pipelines.core');
            }
        }

        let urpInc = '**/Library/PackageCache/com.unity.render-pipelines.universal*/**/*.hlsl';
        let urpExc = "**/Editor/**";
        let urpFiles = await Utils.findFilesIgnoringExclude(urpInc, urpExc);
        if (urpFiles != null) {
            for (let index = 0; index < urpFiles.length; index++) {
                const element = urpFiles[index];
                CollectInclude(vscode.Uri.file(element), 'com.unity.render-pipelines.universal');
            }
        }

    }

    function CollectInclude(element: vscode.Uri, spliter: string) {
        let sourcePath = element.fsPath;
        let a = sourcePath.split(spliter)[1];
        let b = a.indexOf('/');
        let c = a.substring(b);
        let fileName = path.basename(sourcePath);
        let dir = path.dirname(sourcePath);
        let item = new vscode.CompletionItem("include " + fileName, vscode.CompletionItemKind.Snippet);
        item.detail = "Provide by Shading With Unity Extension\n"

        item.documentation = new vscode.MarkdownString("Extension");
        item.filterText = "include " + fileName

        item.insertText = `include \"Packages/${spliter}${c}\"`;

        _PushFunctionItem(item);
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

        if (withLog) console.log("收录文件: " + docPath);
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
            if (withLog) console.log("收录Include: " + includeFile);
            let includeDoc = await SaveOpenDoc(vscode.Uri.file(includeFile))
            await PackDocument(includeDoc);
        }
    }



    export async function PackFunc(filePath: string, lineTrimed: string, lineIndex: number) {
        let func = Utils.UnpackLineTrimed(lineTrimed, lineIndex);
        if (func == null) return;
        func.filePath = filePath;
        if (withLog) console.log(`\t收录方法[${func.function}]`);
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
        // if (word.length == 0) return;

        let firstLetter = word[0];
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


        if (lineTrimed.startsWith('#i')) {
            return _QuickInclude;
        }

        if (firstLetter == '_') return _Snippets;

        return null;
    }

    export const Provider = { provideCompletionItems };

}
export = FunctionPacker;