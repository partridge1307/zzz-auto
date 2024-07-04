const script_properties = PropertiesService.getScriptProperties();

const COOKIE = [script_properties.getProperty("COOKIE_1")];
const DISCORD_WEBHOOK = script_properties.getProperty("DISCORD_WEBHOOK");

const ACT_ID = "e202406031448091";
const BASE_URL = "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os";

class Discord {
	constructor (DISCORD_WEBHOOK) {
		this.webhook = DISCORD_WEBHOOK;
	}

	async send (data = {}, logged = false) {
		if (!this.webhook) {
			return;
		}

		if (logged) {
			const res = UrlFetchApp.fetch(this.webhook, {
				method: "POST",
				contentType: "application/json",
				payload: JSON.stringify({
					embeds: [
						{
							title: "Zenless Zen Zero Auto Check-in",
							author: {
								name: "Zenless Zen Zero",
								icon_url: "https://cdn.discordapp.com/emojis/1250868517620945006.webp?size=128&quality=lossless"
							},
							description: data.message,
							color: 0xBB0BB5,
							timestamp: new Date(),
							footer: {
								text: "Zenless Zen Zero Auto Check-in"
							}
						}
					],
					username: "Zenless Zen Zero",
					avatar_url: "https://cdn.discordapp.com/emojis/1250868517620945006.webp?size=128&quality=lossless"
				})
			});

			if (res.getResponseCode() !== 204) {
				throw new Error(`Discord webhook error: ${res.getResponseCode()}`);
			}

			return true;
		}

		const embed = Discord.generateEmbed(data);
		const res = UrlFetchApp.fetch(this.webhook, {
			method: "POST",
			contentType: "application/json",
			payload: JSON.stringify({
				embeds: [embed],
				username: "Zenless Zone Zero",
				avatar_url: "https://cdn.discordapp.com/emojis/1250868517620945006.webp?size=128&quality=lossless"
			})
		});

		if (res.getResponseCode() !== 204) {
			throw new Error(`Discord webhook error: ${res.getResponseCode()}`);
		}

		return true;
	}

	static generateEmbed (data = {}) {
		return {
			title: "Zenless Zone Zero Auto Check-in",
			author: {
				name: "Zenless Zone Zero",
				icon_url: "https://cdn.discordapp.com/emojis/1250868517620945006.webp?size=128&quality=lossless"
			},
			description: `Today's reward: ${data.award.name} x${data.award.count}`
        + `\nTotal signed: ${data.signed}`,
			color: 0xBB0BB5,
			timestamp: new Date(),
			footer: {
				text: "Zenless Zone Zero Auto Check-in"
			}
		};
	}
}

class StarRail {
	constructor (cookie) {
		if (!Array.isArray(cookie)) {
			throw new Error("cookie must be an array");
		}

		this.cookie = cookie;
	}

	static async sign (cookie) {
		const payload = {
			act_id: ACT_ID
		};

		const options = {
			method: "POST",
			headers: {
				"User-Agent": StarRail.userAgent,
				Cookie: cookie
			},
			payload: JSON.stringify(payload)
		};

		const res = UrlFetchApp.fetch(`${BASE_URL}/sign`, options);

		if (res.getResponseCode() !== 200) {
			throw new Error(`Sign HTTP error: ${res.getResponseCode()}`);
		}

		const body = JSON.parse(res.getContentText());
		if (body.retcode !== 0 && body.message !== "OK") {
			throw new Error(`Sign API error: ${body.message}`);
		}

		return true;
	}

	async run () {
		const cookies = this.cookie;

		let counter = 0;
		for (const cookie of cookies) {
			counter++;

			const info = await StarRail.getInfo(cookie);
			const awards = await StarRail.awards(cookie);
			if (awards.length === 0) {
				throw new Error("There's no awards to claim (?)");
			}

			const data = {
				today: info.today,
				total: info.total_sign_day,
				issigned: info.is_sign,
				missed: info.sign_cnt_missed
			};

			const discord = new Discord(DISCORD_WEBHOOK);
			if (data.issigned) {
				await discord.send({ message: `[Account ${counter}]: You've already checked in today, Proxy~` }, true);
				console.log(`[Account ${counter}]: You've already checked in today, Proxy~`);
				continue;
			}

			const totalSigned = data.total;
			const awardData = {
				name: awards[totalSigned].name,
				count: awards[totalSigned].cnt
			};

			const sign = await StarRail.sign(cookie);
			if (sign) {
				console.log(`[Account ${counter}]: Signed in successfully! You have signed in for ${data.total} days!`);
				console.log(`[Account ${counter}]: You have received ${awardData.count}x ${awardData.name}!`);

				if (!DISCORD_WEBHOOK || typeof DISCORD_WEBHOOK !== "string") {
					console.log("No Discord webhook provided, skipping...");
					return true;
				}

				await discord.send({
					signed: data.total,
					award: awardData
				});
			}
		}
	}

	static async getInfo (cookie) {
		const options = {
			headers: {
				"User-Agent": StarRail.userAgent,
				Cookie: cookie
			},
			muteHttpExceptions: true,
			method: "GET"
		};

		const res = UrlFetchApp.fetch(`${BASE_URL}/info?act_id=${ACT_ID}`, options);

		if (res.getResponseCode() !== 200) {
			throw new Error(`Info HTTP error: ${res.getResponseCode()}`);
		}

		const body = JSON.parse(res.getContentText());
		if (body.retcode !== 0 && body.message !== "OK") {
			throw new Error(`Info API error: ${body.message}`);
		}

		return body.data;
	}

	static async awards (cookie) {
		const options = {
			headers: {
				"User-Agent": StarRail.userAgent,
				Cookie: cookie
			},
			muteHttpExceptions: true,
			method: "GET"
		};

		const res = UrlFetchApp.fetch(`${BASE_URL}/home?act_id=${ACT_ID}`, options);

		if (res.getResponseCode() !== 200) {
			throw new Error(`HTTP error: ${res.getResponseCode()}`);
		}

		const body = JSON.parse(res.getContentText());

		if (body.retcode !== 0 && body.message !== "OK") {
			throw new Error(`API error: ${body.message}`);
		}

		return body.data.awards;
	}

	static get userAgent () {
		return "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36";
	}
}

function run () {
	const starRail = new StarRail(COOKIE);
	starRail.run()
		.catch((e) => {
			console.error(e);
		});
}
