import * as vscode from 'vscode';
import * as path from 'path';

export class Function {
    filePath: string = "";
    functionName: string = "";
    function: string = "";
    lineIndex: number = 0;

    private _fileName: string | undefined;
    public get fileName(): string | undefined {
        if (this._fileName == null) {
            this._fileName = path.basename(this.filePath);
        }
        return this._fileName;
    }

    private completionItem: vscode.CompletionItem | undefined;
    public getCompletionItem(): vscode.CompletionItem | undefined {
        if (!this.completionItem) {
            // let fileName = path.basename(this.fromFile)
            this.completionItem = new vscode.CompletionItem(this.functionName, vscode.CompletionItemKind.Snippet);
            this.completionItem.detail = "Provide by Shading With Unity Extension\n"
            this.completionItem.insertText = new vscode.SnippetString(this.functionName);
            this.completionItem.documentation = new vscode.MarkdownString(this.function);
            this.completionItem.documentation.appendMarkdown("\n\n---\n\n" + this.fileName);
            this.completionItem.filterText = '_' + this.functionName;
        }
        return this.completionItem;
    }
}
