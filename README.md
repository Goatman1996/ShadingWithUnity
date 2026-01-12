# Shading With Unity

VSCode 插件

支持文件类型:.shader/.hlsl(以下简称文件)

支持 #include 跳转

支持一定的函数跳转
1. 所有聚焦过的文件，都会‘收录’内涵的函数以供跳转
2. 所有被‘收录’的用户文件的，都会递归‘收录’其包含的include（‘收录’Package中的文件时，不会递归‘收录’）
3. 插件设置 'shadingwithunity.alwaysIncludes' 可以提供默认的‘收录’文件，启动即‘收录’

支持自动补全
1. 支持被收录的函数的自动补全，触发关键字符是'_',如输入 _Tran...时会触发自动补全提示
2. 支持inlcude 自动补全，触发关键字是'#i'

