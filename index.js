const Axios = require('axios');
const Bluebird = require('bluebird');

const cdnList = require('./cdn');
const cdnLen = cdnList.length;

const cacher = {};

const scanMaker = function(cachePath, G) {
	return async function scanner(fileName, force = false) {
		let stat = cacher[fileName];
		let realPath = R(cachePath, fileName);

		if(typeof stat == 'number') {
			return {
				success: null,
				fileName,
				text: `正在扫描, 请稍后再试, 当前进度{${stat}/${cdnLen}}`
			};
		}
		else if(stat === true) {
			G.trace(`扫描 {${fileName}}: 已缓存, 直接读取`);

			return {
				success: true,
				buffer: _fs.readFileSync(realPath)
			};
		}
		else if(stat === false && !force) {
			return {
				success: false,
				fileName
			};
		}
		else if(_fs.existsSync(realPath) && !force) {
			G.trace(`扫描 {${fileName}}: 已缓存, 直接读取`);

			return {
				success: true,
				buffer: _fs.readFileSync(realPath)
			};
		}

		cacher[fileName] = 0;

		let gainData;

		let testCDN = [];

		await Bluebird.map(cdnList, async function(ip, idx) {
			if(gainData) { return; }
			if(ip.startsWith('x')) { return; }

			// if(!ip.startsWith('m')) {
			// 	return;
			// }
			// else {
			// 	ip = ip.replace('m', '');
			// }

			try {
				let buffer = await Axios.get(`http://${ip}/large/${fileName}?ali_redirect_domain=wx1.sinaimg.cn`, {
					responseType: 'arraybuffer',
					maxRedirects: 0,
					timeout: 1000 * 60,
					headers: {
						Host: 'wx1.sinaimg.cn',
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.46 Safari/537.36'
					}
				});

				_fs.writeFileSync(realPath, buffer.data);

				G.trace(`扫描 {${fileName}}: 尝试成功, ${cacher[fileName] + 1}/${idx}/${cdnLen} {${ip}} ${~~(buffer.data.length / 1024)} KB`);

				cacher[fileName] = true;

				if(!gainData) {
					gainData = {
						success: true,
						buffer: buffer.data
					};
				}
			}
			catch(error) {
				let fidx = gainData ? cacher[fileName] + 1 : cacher[fileName]++;

				if(error.response && error.response.status) {
					G.trace(`扫描 {${fileName}}: 尝试失败, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.response.status}`);
					// G.trace(`扫描: 尝试失败, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.response.status}`, error.response.headers.location);
				}
				else if(error.code == 'ETIMEDOUT' || error.code == 'ECONNRESET' || error.code == 'ECONNABORTED') {
					G.trace(`扫描 {${fileName}}: 尝试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
					// G.error(`扫描: 尝试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
				}
				else {
					G.error(`扫描 {${fileName}}: 尝试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
					// G.error(`扫描: 尝试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
				}

				testCDN.push([ip, error.code || error.response.status]);
			}
		}, { concurrency: 14 });

		if(gainData) {
			return gainData;
		}
		else {
			// 扫描失败
			cacher[fileName] = false;

			// G.info(JSON.stringify(testCDN.sort()));
			// await Bluebird.map(testCDN, async function([ip], idx) {
			// 	try {
			// 		let buffer = await Axios.get(`http://${ip}/large/6f5ef307gy1g5c7eimuo3j20fi0nadhv.jpg?ali_redirect_domain=wx1.sinaimg.cn`, {
			// 			responseType: 'arraybuffer',
			// 			maxRedirects: 0,
			// 			timeout: 1000 * 60,
			// 			headers: {
			// 				Host: 'wx1.sinaimg.cn',
			// 				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.46 Safari/537.36'
			// 			}
			// 		});

			// 		G.trace(`扫描: 测试成功, ${cacher[fileName] + 1}/${idx}/${cdnLen} {${ip}} ${~~(buffer.data.length / 1024)} KB`);
			// 	}
			// 	catch(error) {
			// 		let fidx = gainData ? cacher[fileName] + 1 : cacher[fileName]++;

			// 		if(error.response && !error.response.status) {
			// 			G.trace(`扫描: 测试失败, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.response.status}`, error.response.headers.location);
			// 		}
			// 		else if(error.code == 'ETIMEDOUT' || error.code == 'ECONNRESET' || error.code == 'ECONNABORTED') {
			// 			G.error(`扫描: 测试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
			// 		}
			// 		else {
			// 			G.error(`扫描: 测试错误, ${fidx}/${idx}/${cdnLen} {${ip}} ${error.message || error}`);
			// 		}
			// 	}
			// }, { concurrency: 14 });

			return {
				success: false,
				fileName,
			};
		}
	};
};

const faceMaker = function(cachePath, G) {
	let scanner = scanMaker(cachePath, G);

	return async function face(raw, ctx) {
		const fileName = ctx.params.fileName;

		if(!fileName || !/\w+?\.(jpg|gif|jpeg|png|bmp)$/.test(fileName)) {
			if(fileName && fileName == 'who') {
				ctx.type = 'text';

				return 'simg.190725';
			}
			else {
				ctx.status = 403;
			}
		}
		else {
			G.trace(`扫描 {${fileName}}, 请求来源{${ctx.ip}}`);

			let result = await scanner(fileName, ctx.query.force !== undefined);

			if(result.success) {
				G.info(`扫描 {${fileName}}: 成功`);

				ctx.type = _pa.parse(fileName).ext;

				return result.buffer;
			}
			else if(result.success === null) {
				G.info(`扫描 {${fileName}}: 重复请求, 正在扫描, 当前进度{${cacher[fileName]}/${cdnLen}}`);

				ctx.type = 'json';

				return result;
			}
			else if(result.success === false) {
				G.info(`扫描 {${fileName}}: 失败`);

				ctx.type = 'json';

				return result;
			}
		}
	};
};

module.exports = async function SimgScan({ C, G, Harb }) {
	try {
		_fs.mkdirSync(C.path.cache);
	}
	catch(error) {
		if(error.code != 'EEXIST') { throw error; }
	}

	await Harb({
		routs: [
			{ type: 1, id: 1, method: 'get', path: ':fileName', _stat: {}, func: faceMaker(C.path.cache, G) },
		],
	});
};