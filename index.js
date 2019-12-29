require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');
const bodyParser = require('body-parser');
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const forwardingAddress = 'https://bell.ml'; // Replace this with your HTTPS Forwarding address
//////////////////
//////////////////

// app
const app = express();

// db
mongoose
	.connect(process.env.DATABASE, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useUnifiedTopology: true
	})
	.then(() => console.log('DB Connected'));

// middlewares
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: true
	})
);

app.get('/get', (req, res) => {
	res.send('hi there!');
});

app.get('/', (req, res) => {
	res.send('isntall seccessfully!');
});

//install route
app.get('/shopify', (req, res) => {
	const shop = req.query.shop;
	if (shop) {
		const state = nonce();
		const redirectUri = forwardingAddress + '/shopify/callback';
		const installUrl =
			'https://' +
			shop +
			'/admin/oauth/authorize?client_id=' +
			apiKey +
			'&scope=' +
			[ 'read_customers', 'write_customers' ] +
			'&state=' +
			state +
			'&redirect_uri=' +
			redirectUri;
		res.cookie(req.query.shop, state);
		res.redirect(installUrl);
	} else {
		return res
			.status(400)
			.send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
	}
});
//callback route
app.get('/shopify/callback', (req, res) => {
	let { shop, hmac, code, state } = req.query;
	const stateCookie = cookie.parse(req.headers.cookie)[`${shop}`];
	if (state !== stateCookie) {
		return res.status(403).send('Request origin cannot be verified');
	}
	if (shop && hmac && code) {
		const map = Object.assign({}, req.query);
		delete map['signature'];
		delete map['hmac'];
		const message = querystring.stringify(map);
		const providedHmac = Buffer.from(hmac, 'utf-8');
		const generatedHash = Buffer.from(crypto.createHmac('sha256', apiSecret).update(message).digest('hex'), 'utf-8');
		let hashEquals = false;
		try {
			hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
		} catch (e) {
			hashEquals = false;
		}
		if (!hashEquals) {
			return res.status(400).send('HMAC validation failed');
		}
		const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
		const accessTokenPayload = {
			client_id: apiKey,
			client_secret: apiSecret,
			code
		};
		request
			.post(accessTokenRequestUrl, {
				json: accessTokenPayload
			})
			.then((accessTokenResponse) => {
				console.log(accessTokenResponse);
				res.redirect('/');
			})
			.catch((error) => {
				res.send(error);
			});
	} else {
		res.status(400).send('Required parameters missing');
	}
});

const port = process.env.PORT || 8000;

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
