const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'SuperAdmin123!';
    const saltRounds = 10;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);
        
        // Verificar que funciona
        const isValid = await bcrypt.compare(password, hash);
        console.log('Hash verification:', isValid);
        
        return hash;
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generateHash();
