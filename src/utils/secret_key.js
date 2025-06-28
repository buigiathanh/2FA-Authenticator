import base32Encode from "base32-encode";
import * as CryptoJS from "crypto-js";

export const byteArray2Base32 = (bytes) => {
    try {
        return base32Encode(new Uint8Array(bytes), 'RFC4648', {padding: true});
    } catch (error) {
        return '';
    }
};

export const wordArrayToByteArray = (wordArray) => {
    const bytes = [];
    for (let i = 0; i < wordArray.words.length; i++) {
        const word = wordArray.words[i];
        for (let j = 3; j >= 0; j--) {
            bytes.push((word >> (8 * j)) & 0xff);
        }
    }
    bytes.length = wordArray.sigBytes;
    return bytes;
};

export const byteArray2String = (bytes) => String.fromCharCode(...bytes);

export const subBytesArray = (bytes, start, length) => bytes.slice(start, start + length);

export const getOTPAuthPerLineFromOPTAuthMigration =(migrationUri) => {
    if (!migrationUri.startsWith('otpauth-migration:')) return [];

    try {
        const base64Data = decodeURIComponent(migrationUri.split('data=')[1]);
        const wordArrayData = CryptoJS.enc.Base64.parse(base64Data);
        const byteData = wordArrayToByteArray(wordArrayData);
        const lines = [];
        let offset = 0;

        while (offset < byteData.length) {
            if (byteData[offset] !== 10) break;
            const lineLength = byteData[offset + 1];
            const secretStart = offset + 4;
            const secretLength = byteData[offset + 3];
            const secretBytes = subBytesArray(byteData, secretStart, secretLength);
            const secret = byteArray2Base32(secretBytes);
            const accountStart = secretStart + secretLength + 2;
            const accountLength = byteData[secretStart + secretLength + 1];
            const accountBytes = subBytesArray(byteData, accountStart, accountLength);
            const account = byteArray2String(accountBytes);
            const issuerStart = accountStart + accountLength + 2;
            const issuerLength = byteData[accountStart + accountLength + 1];
            const issuerBytes = subBytesArray(byteData, issuerStart, issuerLength);
            const issuer = byteArray2String(issuerBytes);
            const algorithm = ['SHA1', 'SHA1', 'SHA256', 'SHA512', 'MD5'][byteData[issuerStart + issuerLength + 1]] || 'SHA1';
            const digits = [6, 6, 8][byteData[issuerStart + issuerLength + 3]] || 6;
            const type = ['totp', 'hotp', 'totp'][byteData[issuerStart + issuerLength + 5]] || 'totp';

            let line = `otpauth://${type}/${account}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}`;
            if (type === 'hotp') {
                const counter = byteData[issuerStart + issuerLength + 7] || 1;
                line += `&counter=${counter}`;
            }
            lines.push(line);
            offset += lineLength + 2;
        }
        return lines;
    } catch (error) {
        return [];
    }
};

export const getTimeOTP = () => {
    const options = window.otplib.authenticator.allOptions();
    return options.step - (new Date(options.epoch).getSeconds() % options.step);
}

export const getCode2FA = (code) => {
    return window.otplib.authenticator.generate(code.replace(/\s/g, ''));
}

