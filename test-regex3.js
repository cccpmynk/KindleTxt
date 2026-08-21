const str = "他表示严禁篡改历史，并且未经许可不得入内。";
const regex = /(?:(?:严禁|未经|许可|篡改|篡禁|C?\d{5,})\s*){2,}/gi;
console.log(str.replace(regex, " "));
