'use strict'

import ws = require('ws');
import fs = require('fs-extra');
import path = require('path');

import {Login, LoginRequest, LoginResponse} from "./login";


//Cleaning working folder before launch and ensure that cookies exist
(async () => {
    await fs.remove(path.resolve(__dirname, 'loginDirs'));
    await fs.mkdirp(path.resolve(__dirname, 'loginDirs'));
    await fs.mkdirp(path.resolve(__dirname, 'cookies'));
    await fs.mkdirp(path.resolve(__dirname, 'errors'));
})();
const server = new ws.Server({
    port: 5012,
});


let doubleAuthLogins = new Map();

server.on('connection', function connection(socket) {
    console.log('Login: connection established');

    socket.onclose = function () {
        console.log('Login: connection finished');
    }

    socket.on('message', async function incoming(message: Buffer) {
        console.log(`Login: ${message.toString()}`);
        const userData: LoginRequest = JSON.parse(message.toString());
        switch (userData.type) {
            case 'Login':
                try {
                    let browserData = await Login.getBrowserAndPage();
                    let login = new Login(browserData);
                    const loginInfo: LoginResponse = await login.login(userData.username, userData.body);
                    if (loginInfo.status && loginInfo.is_double_auth) {
                        doubleAuthLogins.set(loginInfo.username, login);
                    }
                    const loginJSON = JSON.stringify(loginInfo);
                    console.log(`Login login sent: ${loginJSON}`);
                    socket.send(Buffer.from(loginJSON));
                } catch (e) {
                    let errorInfo: LoginResponse = {
                        status: false,
                        username: userData.username,
                        error_message: "Failure to start browser: " + e.message,
                    }
                    const errorJSON = JSON.stringify(errorInfo);
                    console.log(`Login login sent: ${errorJSON}`);
                    socket.send(Buffer.from(errorJSON));
                }
                break;
            case 'DoubleAuth':
                if (doubleAuthLogins.has(userData.username)) {
                    let login: Login = doubleAuthLogins.get(userData.username);
                    let doubleAuthInfo = await login.doubleAuth(userData.username, userData.body);
                    const doubleAuthJSON = JSON.stringify(doubleAuthInfo);
                    console.log(`Login doubleAuth sent: ${doubleAuthJSON}`);
                    socket.send(Buffer.from(doubleAuthJSON));
                } else {
                    let errorInfo: LoginResponse = {
                        status: false,
                        username: userData.username,
                        error_message: `There's no such username in doubleAuth map -- ${userData.username}`,
                    }
                    const errorJSON = JSON.stringify(errorInfo);
                    console.log(`Login doubleAuth sent: ${errorJSON}`);
                    socket.send(Buffer.from(errorJSON));
                }
                break;
        }
    })
});


