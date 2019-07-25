const L = (console || {}).log;
const LE = (console || {}).error;

const _fs = require('fs');

const Axios = require('axios');

const cdnList = require('./cdn');

const catcher = async function(url) {
	let [fileName] = url.match(/(\w+?\.\w+)$/g);

	let cdnLen = cdnList.size;

	let count = 1;

	for(let ip of cdnList) {
		try {
			let buffer = await Axios.get(`http://${ip}/large/${fileName}`, {
				responseType: 'arraybuffer',
				maxRedirects: 0,
				headers: {
					Host: 'wx1.sinaimg.cn',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.46 Safari/537.36'
				}
			});

			_fs.writeFileSync(`./${fileName}.${ip}.jpg`, buffer.data);

			L(`-------${fileName}-------`);
			L('[Done]', count++, cdnLen, ip, buffer.status, `${~~(buffer.data.length / 1024)} KB`);

			return;
		}
		catch(error) {
			if(error.response && error.response.status) {
				L('[Fail]', count++, cdnLen, ip, error.response.status);
			}
			else {
				LE('[Fail]', count++, cdnLen, ip, error.message || error);
			}
		}
	}
};

(async () => {
	catcher('https://wx4.sinaimg.cn/mw690/006kaPr3gy1g43ylm8awoj30kp0rc14p.jpg');
})();