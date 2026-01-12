// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as FunctionPacker from './FunctionPacker';
import Utils from './Utils';

const packageFolders = new Map<string, string>();

export async function activate(context: vscode.ExtensionContext) {
	console.log('插件启动');
	vscode.window.showInformationMessage('插件启动');

	await Launch();

	context.subscriptions.push(vscode.languages.registerHoverProvider(['shaderlab', 'hlsl'], { provideHover }));
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(['shaderlab', 'hlsl'], { provideDefinition }));

	// 定义代码片段
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(['shaderlab', 'hlsl'], FunctionPacker.Provider));

	// shadingwithunity.Test
	context.subscriptions.push(vscode.commands.registerCommand('shadingwithunity.Test', () => {
		vscode.window.showInformationMessage(`
			doc[${FunctionPacker.GetPackedCount()}] 
			func[${FunctionPacker.GetFuncCount()}]
			inc[${FunctionPacker.GetInCludeCount()}]
			`);
	}));

	// 监听打开文件时
	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(FunctionPacker.PackDocument));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			FunctionPacker.PackDocument(editor?.document);
		}
	}));

	if (vscode.window.activeTextEditor != null) {
		FunctionPacker.PackDocument(vscode.window.activeTextEditor.document);
	}
}

async function Launch() {
	await Utils.LaunchAsync();
	await FunctionPacker.Launch();
}

async function provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
	const fileName = document.fileName;
	const workDir = path.dirname(fileName);
	const word = document.getText(document.getWordRangeAtPosition(position));
	const line = document.lineAt(position);
	const lineTrimed = line.text.trim();

	// #include
	let includeString = Utils.GetIncludeString(lineTrimed);
	if (includeString) {
		let includePath = Utils.GetAbsoluteIncludePath(workDir, includeString);
		if (includePath == null || includePath == '') return null;
		return new vscode.Location(vscode.Uri.file(includePath), new vscode.Position(0, 0));
	}
	else {
		let ret = [];
		let mathcedList = FunctionPacker.GetMatchedFunc(word);
		if (mathcedList.length == 0) return null;
		for (let i = 0; i < mathcedList.length; i++) {
			let item = mathcedList[i];
			ret.push(new vscode.Location(vscode.Uri.file(item.filePath), new vscode.Position(item.lineIndex, 0)));
		}

		return ret;
	}


}

async function provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
	const fileName = document.fileName;
	const workDir = path.dirname(fileName);
	const word = document.getText(document.getWordRangeAtPosition(position));
	const line = document.lineAt(position).text;
	const lineTrimed = line.trim();
	if (lineTrimed.startsWith("#include")) return;

	// 等一秒
	// await new Promise(resolve => setTimeout(resolve, 30));

	// 获取当前目录

	if (token.isCancellationRequested) {
		// console.log('token.isCancellationRequested');
		return;
	}

	// 使用 Markdown 格式，支持换行
	const content = new vscode.MarkdownString();


	let funcName = Utils.getFunctionNameAtCursor(document, position);
	let matchedList = FunctionPacker.GetMatchedFunc(word);
	if (matchedList.length == 0) return;
	content.appendMarkdown(`**快速查看**:  \n`);

	for (let i = 0; i < matchedList.length; i++) {
		const func = matchedList[i];
		content.appendMarkdown(`${func.function}  \n`);
	}

	// const filePath = vscode.Uri.file(func.filePath).with({ fragment: `L${func.lineIndex},${0}` });
	// content.appendMarkdown(`[[${func.function}]](${filePath})  \n`);


	return new vscode.Hover(content);


}




// This method is called when your extension is deactivated
export function deactivate() { }