const readline = require("readline");
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

let buffer = "";

process.stdin.on("keypress", (str, key) => {
    if (key.name === "return" && key.shift) {
        buffer += "\n"; // 插入换行
        process.stdout.write("\n");
    } else if (key.name === "return") {
        console.log("");
        buffer = "";
    } else {
        buffer += str;
        process.stdout.write(str);
    }
});
