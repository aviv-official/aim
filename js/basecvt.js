export let BASE2  = "01";
export let BASE8  = "01234567";
export let BASE10 = "0123456789";
export let BASE16 = "0123456789abcdef";
export let BASE32 = "0123456789abcdefghijklmnopqrstuvwxyz";
export let BASE64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/=";
export let BASE75 = "_.?!=-*@#$%+0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function convert(src, srctable, desttable){
	let srclen = srctable.length;
	let destlen = desttable.length;
	// first convert to base 10
	let val = 0;
	let numlen = src.length;
	for (let i = 0; i < numlen; i ++)
	{
		val = val * srclen + srctable.indexOf(src.charAt(i));
	}
	if (val < 0)
	{
		return 0;
	}
	// then covert to any base
	let r = val % destlen;
	let res = desttable.charAt(r);
	let q = Math.floor(val / destlen);
	while (q)
	{
		r = q % destlen;
		q = Math.floor(q / destlen);
		res = desttable.charAt(r) + res;
	}
	return res;
}