const WebSocket = require('ws');
const readline = require('readline-promise').default;
const ws = new WebSocket('ws://localhost:5013');


/*ws.on('open', function open() {
    ws.send(JSON.stringify({inst_id: 14490532747, action: 'Start', timeout: 20000}));
});
*/
/*
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

(async () => {
    while(1){
        let data = await rl.questionAsync('');
        ws.send(data);
    }
})();
*/
ws.on('open', function open() {
    ws.send(JSON.stringify({inst_id: 1449053277, action: 'Logout'}));
});

/*
ws.on('open', function open() {
    ws.send(JSON.stringify({username: 'orgazm.exe', password: 'G4V92FBf'}));
});
*/
/*
ws.on('open', function open() {
    ws.send(JSON.stringify({type: 'Login', username: 'daniel_maybe_still_alive', body: '5KXDLKrbfrgyYrJ'}));
});
*/
ws.on('message', function incoming(data) {
    console.log(data);
});
