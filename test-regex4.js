const str = "我转了一个pdf，感觉不错，不过，还是出现了严禁篡禁篡改C20260 许可0053330 严禁这样的水印内容";
const regex = /(?=.*[严禁篡改未经许可])(?=.*\d)[严禁篡改未经许可C0-9\s]{10,}/g;
console.log(str.replace(regex, " "));
