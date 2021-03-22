import ws = require('ws');

const fs = require('fs-extra');
import path = require('path');

import * as File from "./file";

import {getFollowers, StatsRequest, StatsResponse} from "./stats";


let activeFollowerGetters: Set<string> = new Set();

async function getAndSendFollowersCount(socket: any, id: string, timeout: number) {

    try {
        await File.acquireMutex(id);
        const usersInfo: StatsResponse = await getFollowers(id);
        File.releaseMutex(id);
        const userJSON: string = JSON.stringify(usersInfo);
        if (activeFollowerGetters.has(id)) {
            console.log(`Stats sent: ${userJSON.slice(0, 150)}`);
            socket.send(Buffer.from(userJSON));
        } else {
            console.log(`Stats didn't send: followers were counted but user isn't in set ${id}`);
        }
    } catch (e) {
        const errorJSON: string = JSON.stringify(e.message);
        console.log(`Stats sent: ${errorJSON}`);
        socket.send(Buffer.from(errorJSON));
    } finally{

    }

    if (activeFollowerGetters.has(id)) {
        setTimeout(getAndSendFollowersCount, timeout, socket, id, timeout);
    }
}

export function runStatsServer(server: ws.Server) {
    server.on('connection', function connection(socket) {

        console.log('Stats: connection established');

        socket.onclose = function () {
            console.log('Stats: connection closed');
        }

        socket.on('message', async function incoming(message: Buffer) {
            console.log(`Stats: ${message.toString()}`);
            const request: StatsRequest = JSON.parse(message.toString());

            switch (request.action) {
                case 'Start':
                    if (activeFollowerGetters.has(request.inst_id)) {
                        break;
                    }
                    activeFollowerGetters.add(request.inst_id);
                    let timeout: number = 60000;
                    if (request.timeout != undefined) {
                        timeout = request.timeout;
                    }
                    getAndSendFollowersCount(socket, request.inst_id, timeout).catch(e => console.log(`Error while getting data: ${e}`));
                    break;
                case 'Stop':
                    activeFollowerGetters.delete(request.inst_id);
                    break;
                case 'Logout':
                    try {
                        activeFollowerGetters.delete(request.inst_id);
                        //Говно решение. Возможна ситуация когда посередине что нибудь вклиниться
                        if (await File.isUserLoggedInBot(request.inst_id)) {
                            await File.acquireMutex(request.inst_id);
                            await fs.remove(path.resolve(__dirname, path.resolve(__dirname, `cookies/${request.inst_id}`)));
                            File.releaseMutex(request.inst_id);
                            let okResponse: StatsResponse = {
                                status: true,
                                inst_id: request.inst_id,
                            };
                            let okJSON = JSON.stringify(okResponse);
                            console.log(`Stats sent: ${okJSON}`);
                            socket.send(Buffer.from(okJSON));
                        } else {
                            let errorObj: StatsResponse = {
                                status: false,
                                inst_id: request.inst_id,
                                errorMessage: `Error: there's no such user.`,
                            };
                            let errorJSON = JSON.stringify(errorObj);
                            console.log(`Stats sent: ${errorJSON}`);
                            socket.send(Buffer.from(errorJSON));
                        }
                    } catch (e) {
                        let errorObj: StatsResponse = {
                            status: false,
                            inst_id: request.inst_id,
                            errorMessage: `Failure during logout: ${e.message}`,
                        };
                        let errorJSON = JSON.stringify(errorObj);
                        console.log(`Stats sent: ${errorJSON}`);
                        socket.send(Buffer.from(errorJSON));
                    }
                    break;
            }
        })
    });
}
