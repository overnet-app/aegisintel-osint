
const argon2 = require('argon2');

async function test() {
    const pass = 'password123';
    const hash = await argon2.hash(pass);
    console.log('Hash:', hash);
    const match = await argon2.verify(hash, pass);
    console.log('Match:', match);
    const fail = await argon2.verify(hash, 'wrong');
    console.log('Wrong match (should be false):', fail);
}

test().catch(console.error);
