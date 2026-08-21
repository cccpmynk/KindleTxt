const str = "我转了一个pdf，感觉不错，不过，还是出现了严禁篡禁篡改C20260 许可0053330 严禁这样的水印内容";
let cleaned = str;
const patterns = [
    /严\s*禁\s*[篡禁改]+/gi,
    /未\s*经\s*[许可]+/gi,
    /[a-zA-Z]?[0-9]{4,}\s*[未经许可严禁篡改]{1,4}\s*[0-9]{4,}/gi,
    /[a-zA-Z]?[0-9]{8,25}/g,
    /[严禁篡改未经许可]+/g
];
for (const p of patterns) {
    cleaned = cleaned.replace(p, " ");
}
console.log(cleaned);
