const str = "严禁篡禁篡改C20260 许可0053330 严禁";
const regex = /(?:(?:严禁|未经|许可|篡改|篡禁|C?\d{5,})\s*){2,}/gi;
console.log(str.replace(regex, " "));
