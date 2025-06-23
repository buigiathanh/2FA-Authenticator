/*global chrome*/
import {useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {CountdownCircleTimer} from 'react-countdown-circle-timer';
import * as CryptoJS from 'crypto-js';
import QRCode from 'qrcode';
import base32Encode from 'base32-encode';
import {extension} from '../../utils/chrome';

const ExtensionSidePanel = () => {
    const qrRef = useRef(null);
    const popupCreateRef = useRef(null);
    const popupUpdateRef = useRef(null);

    const [formState, setFormState] = useState({
        website: '',
        account: '',
        secret: '',
        errors: {
            website: '',
            account: '',
            secret: ''
        },
    });

    const [secretKeys, setSecretKeys] = useState([]);
    const [countdown, setCountdown] = useState(30);
    const [message, setMessage] = useState({text: '', visible: false});
    const [qrLink, setQRLink] = useState('');
    const [keyEdit, setKeyEdit] = useState(null);
    const [code, setCode] = useState('');
    const [keySearch, setKeySearch] = useState('');
    const [isCreate, setIsCreate] = useState(false);
    const [isLoading, setIsLoading] = useState(false);


    const byteArray2Base32 = useCallback((bytes) => {
        try {
            return base32Encode(new Uint8Array(bytes), 'RFC4648', {padding: true});
        } catch (error) {
            return '';
        }
    }, []);

    const wordArrayToByteArray = useCallback((wordArray) => {
        const bytes = [];
        for (let i = 0; i < wordArray.words.length; i++) {
            const word = wordArray.words[i];
            for (let j = 3; j >= 0; j--) {
                bytes.push((word >> (8 * j)) & 0xff);
            }
        }
        bytes.length = wordArray.sigBytes;
        return bytes;
    }, []);

    const byteArray2String = useCallback((bytes) => String.fromCharCode(...bytes), []);

    const subBytesArray = useCallback((bytes, start, length) => bytes.slice(start, start + length), []);


    const getOTPAuthPerLineFromOPTAuthMigration = useCallback((migrationUri) => {
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
    }, [byteArray2Base32, wordArrayToByteArray, byteArray2String, subBytesArray]);


    const showMessage = useCallback((text, duration = 3000) => {
        setMessage({text, visible: true});
        setTimeout(() => setMessage({text: '', visible: false}), duration);
    }, []);


    const handleGetCode2FA = useCallback(async () => {
        if (!code) {
            showMessage(extension.getLang("message_get_code_empty"));
            return;
        }
        try {
            setIsLoading(true);
            const value = window.otplib.authenticator.generate(code.replace(/\s/g, ''));
            await navigator.clipboard.writeText(value);
            showMessage(extension.getLang("message_get_code_success"));
        } catch (error) {
            showMessage(extension.getLang("message_get_code_error"));
        } finally {
            setIsLoading(false);
        }
    }, [code, showMessage]);


    const handleCopy = useCallback(async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            showMessage(extension.getLang("message_copy_success"));
        } catch (error) {
            showMessage(extension.getLang("message_copy_error"));
        }
    }, [showMessage]);


    const deleteSecretKey = useCallback(async (secretKey) => {
        try {
            setIsLoading(true);
            const updatedKeys = secretKeys.filter(item => item.secretKey !== secretKey);
            setSecretKeys(updatedKeys);
            await extension.storage.setItem('list_secret_key_2fa', JSON.stringify(updatedKeys));
            showMessage(extension.getLang("message_delete_success"));
        } catch (error) {
            showMessage(extension.getLang("message_delete_error"));
        } finally {
            setIsLoading(false);
        }
    }, [secretKeys, showMessage]);


    const createQR = useCallback(async (key) => {
        try {
            setIsLoading(true);
            const qrData = `otpauth://totp/${encodeURIComponent(`${key.website.split('.')[0] || ''}:${key.account}`)}?secret=${encodeURIComponent(key.secretKey)}&issuer=${encodeURIComponent(key.website || '')}`;
            const qrUrl = await QRCode.toDataURL(qrData);
            setQRLink(qrUrl);
        } catch (error) {
            showMessage(extension.getLang("message_create_qr_error"));
        } finally {
            setIsLoading(false);
        }
    }, [showMessage]);


    const scanQR = useCallback(async () => {
        try {
            setIsLoading(true);
            const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
            await chrome.tabs.sendMessage(tabs[0].id, {action: 'captureSelection', data: {tab: tabs[0]}});
        } catch (error) {
            showMessage(extension.getLang("message_scan_qr_error"));
        } finally {
            setIsLoading(false);
        }
    }, [showMessage]);


    const fetchSecretKeys = useCallback(async () => {
        try {
            setIsLoading(true);
            const listSecretKeys = await extension.storage.getItem('list_secret_key_2fa');
            const keys = listSecretKeys ? JSON.parse(listSecretKeys) : [];
            setSecretKeys(keys);
            setCountdown(handleGetTime());
        } catch (error) {
            showMessage(extension.getLang("message_get_list_secret_key"));
        } finally {
            setIsLoading(false);
        }
    }, [showMessage]);


    const saveSecretKey = useCallback(async () => {
        const {website, account, secret} = formState;
        if (!website || !account || !secret) {
            setFormState(prev => ({
                ...prev,
                errors: {
                    website: website ? '' : extension.getLang("message_website_empty"),
                    account: account ? '' : extension.getLang("message_account_empty"),
                    secret: secret ? '' : extension.getLang("message_secret_key_empty"),
                },
            }));
            return;
        }

        try {
            setIsLoading(true);
            const newKey = {website, account, secretKey: secret};
            const updatedKeys = [...secretKeys, newKey];
            setSecretKeys(updatedKeys);
            await extension.storage.setItem('list_secret_key_2fa', JSON.stringify(updatedKeys));
            setFormState({website: '', account: '', secret: '', errors: {}});
            setIsCreate(false);
            showMessage(extension.getLang("message_add_success"));
        } catch (error) {
            showMessage(extension.getLang("message_add_error"));
        } finally {
            setIsLoading(false);
        }
    }, [formState, secretKeys, showMessage]);


    const handleGetTime = useCallback(() => {
        const options = window.otplib.authenticator.allOptions();
        return options.step - (new Date(options.epoch).getSeconds() % options.step);
    }, []);


    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            handleGetCode2FA().then();
        }
    }, [handleGetCode2FA]);


    const resetForm = useCallback(() => {
        setFormState({website: '', account: '', secret: '', errors: {}});
    }, []);


    const filteredKeys = useMemo(() => {
        if (!keySearch) return secretKeys;
        const lowerSearch = keySearch.toLowerCase();
        return secretKeys.filter(
            item => item.account.toLowerCase().includes(lowerSearch) || item.website.toLowerCase().includes(lowerSearch)
        );
    }, [keySearch, secretKeys]);


    const handleClickOutside = useCallback((event) => {
        if (qrRef.current && !qrRef.current.contains(event.target)) {
            setQRLink('');
        }
        if (popupCreateRef.current && !popupCreateRef.current.contains(event.target)) {
            setIsCreate(false);
            resetForm();
        }
        if (popupUpdateRef.current && !popupUpdateRef.current.contains(event.target)) {
            setKeyEdit(null);
            resetForm();
        }
    }, [resetForm]);


    useEffect(() => {
        const intervalId = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? handleGetTime() : prev - 1));
        }, 1000);
        return () => clearInterval(intervalId);
    }, [handleGetTime]);


    useEffect(() => {
        fetchSecretKeys().then();

        const handleStorageChange = (changes) => {
            if (changes.list_secret_key_2fa?.newValue) {
                fetchSecretKeys().then();
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, [fetchSecretKeys]);


    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);


    useEffect(() => {
        if (isCreate || keyEdit) {
            resetForm();
        }
    }, [isCreate, keyEdit, resetForm]);

    return (
        <div className="w-full h-[100vh] bg-[#282828] box-border">
            <div className="w-full m-auto bg-[#282828] flex justify-center">
                <div className="h-[100vh] w-full inline-block box-border overflow-y-auto">
                    <div className="w-full relative p-[20px]" style={{height: 'calc(100vh - 70px)'}}>
                        <div className="w-full mb-[20px]">
                            <h5 className="font-bold text-white text-[16px] mb-[5px]">
                                {extension.getLang("title")}
                            </h5>
                            <p className="text-white text-[12px] mb-[5px]">
                                {extension.getLang("description_title")}
                            </p>
                        </div>

                        <div className="w-full">
                            <div className="w-full flex justify-between mb-[10px] p-[10px] bg-[#3C3C3C] rounded-[10px]">
                                <div className="inline-block" style={{width: 'calc(100% - 50px)'}}>
                                    <input
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={extension.getLang("placeholder_input")}
                                        className="w-full h-[40px] bg-[#3C3C3C] px-3 border-none outline-none text-white"
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="inline-block pl-3">
                                    <button
                                        onClick={handleGetCode2FA}
                                        type="button"
                                        className="px-3 h-10 text-xs font-medium text-center text-white rounded-lg focus:outline-none bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? extension.getLang("button_get_running") : extension.getLang("button_get")}
                                    </button>
                                </div>
                            </div>
                            <div
                                className="w-full h-[40px] rounded-[10px] mb-[10px] bg-[#3C3C3C] p-[10px] flex justify-between">
                                <div className="inline-block" style={{width: 'calc(100% - 40px)'}}>
                                    <input
                                        onChange={(e) => setKeySearch(e.target.value)}
                                        value={keySearch}
                                        placeholder={extension.getLang("placeholder_search")}
                                        className="w-full h-[20px] bg-[#3C3C3C] border-none outline-none text-white"
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="inline-block w-[20px]">
                                    <svg
                                        className="w-[20px] h-[20px] text-white cursor-pointer"
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke="currentColor"
                                            strokeLinecap="round"
                                            strokeWidth="2"
                                            d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                                        />
                                    </svg>
                                </div>
                            </div>
                            {secretKeys.length > 0 && (
                                <>
                                    {filteredKeys.map((key2FA, index) => (
                                        <div
                                            key={index}
                                            className="w-full group rounded-[10px] mb-[10px] bg-[#3C3C3C] p-[15px] flex justify-between items-center"
                                        >
                                            <div className="inline-block w-[40px]">
                                                <CountdownCircleTimer
                                                    isPlaying
                                                    duration={30}
                                                    size={40}
                                                    strokeWidth={3}
                                                    trailColor="#282828"
                                                    initialRemainingTime={countdown}
                                                    onComplete={() => ({
                                                        shouldRepeat: true,
                                                        newInitialRemainingTime: handleGetTime()
                                                    })}
                                                    colors={countdown > 10 ? '#fff' : '#fca5a5'}
                                                >
                                                    {({remainingTime}) => (
                                                        <span
                                                            className={countdown > 10 ? 'text-white' : 'text-red-300'}>
                                                            {remainingTime}
                                                        </span>
                                                    )}
                                                </CountdownCircleTimer>
                                            </div>
                                            <div className="inline-block pl-5 relative"
                                                 style={{width: 'calc(100% - 40px)'}}>
                                                <p className="w-full text-white mb-[5px] text-[12px] truncate">
                                                    {key2FA.website && key2FA.account
                                                        ? `${key2FA.website} | ${key2FA.account}`
                                                        : `UID: ${key2FA.account}`}
                                                </p>
                                                <h4
                                                    onClick={() => handleCopy(window.otplib.authenticator.generate(key2FA.secretKey.replace(/\s/g, '')))}
                                                    className={`${countdown > 10 ? 'text-white' : 'text-red-300'} text-[18px] font-bold cursor-pointer`}
                                                >
                                                    {window.otplib.authenticator.generate(key2FA.secretKey.replace(/\s/g, ''))}
                                                </h4>
                                                <div className="absolute flex bottom-0 right-0">
                                                    <div
                                                        onClick={() => createQR(key2FA)}
                                                        className="hidden group-hover:inline-block cursor-pointer w-6 h-6 p-1 me-1 last:me-0 rounded hover:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="w-4 h-4 text-white"
                                                            aria-hidden="true"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="24"
                                                            height="24"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                stroke="currentColor"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M4 4h6v6H4V4Zm10 10h6v6h-6v-6Zm0-10h6v6h-6V4Zm-4 10h.01v.01H10V14Zm0 4h.01v.01H10V18Zm-3 2h.01v.01H7V20Zm0-4h.01v.01H7V16Zm-3 2h.01v.01H4V18Zm0-4h.01v.01H4V14Z"
                                                            />
                                                            <path
                                                                stroke="currentColor"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M7 7h.01v.01H7V7Zm10 10h.01v.01H17V17Z"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <div
                                                        onClick={() => deleteSecretKey(key2FA.secretKey)}
                                                        className="hidden group-hover:inline-block cursor-pointer w-6 h-6 p-1 me-1 last:me-0 rounded hover:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="w-4 h-4 text-white"
                                                            aria-hidden="true"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="24"
                                                            height="24"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M8.586 2.586A2 2 0 0 1 10 2h4a2 2 0 0 1 2 2v2h3a1 1 0 1 1 0 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a1 1 0 0 1 0-2h3V4a2 2 0 0 1 .586-1.414ZM10 6h4V4h-4v2Zm1 4a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Zm4 0a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        <div onClick={() => setIsCreate(true)} className="fixed bottom-[10px] right-[10px]">
                            <div
                                className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                <svg
                                    className="w-6 h-6 text-white m-auto inline-block"
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 12h14m-7 7V5"
                                    />
                                </svg>
                            </div>
                        </div>

                        <div onClick={scanQR} className="fixed bottom-[10px] right-[55px]">
                            <div
                                className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                <svg
                                    className="w-6 h-6 text-white m-auto inline-block"
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke="currentColor"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 4h6v6H4V4Zm10 10h6v6h-6v-6Zm0-10h6v6h-6V4Zm-4 10h.01v.01H10V14Zm0 4h.01v.01H10V18Zm-3 2h.01v.01H7V20Zm0-4h.01v.01H7V16Zm-3 2h.01v.01H4V18Zm0-4h.01v.01H4V14Z"
                                    />
                                    <path
                                        stroke="currentColor"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M7 7h.01v.01H7V7Zm10 10h.01v.01H17V17Z"
                                    />
                                </svg>
                            </div>
                        </div>

                        <div className="fixed hidden bottom-[10px] right-[100px]">
                            <div
                                className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                <svg
                                    className="w-6 h-6 text-white m-auto inline-block"
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"
                                    />
                                </svg>
                            </div>
                        </div>

                        {qrLink && (
                            <>
                                <div className="w-full h-[100vh] fixed top-0 left-0 bg-black/70" style={{zIndex: 100}}/>
                                <div
                                    ref={qrRef}
                                    className="fixed bg-white rounded-lg top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] w-[250px] h-auto p-[10px]"
                                    style={{zIndex: 101}}
                                >
                                    <img src={qrLink} className="w-full h-auto mx-auto" alt="QR Code"/>
                                </div>
                            </>
                        )}

                        {message.visible && (
                            <div className="p-[10px] w-full fixed bottom-0 left-0">
                                <div
                                    className="flex items-center w-full p-4 space-x-4 rtl:space-x-reverse text-gray-500 bg-white divide-x rtl:divide-x-reverse divide-gray-200 rounded-lg shadow"
                                    role="alert"
                                >
                                    <svg
                                        className="w-5 h-5 text-blue-600 rotate-45"
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 18 20"
                                    >
                                        <path
                                            stroke="currentColor"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="m9 17 8 2L9 1 1 19l8-2Zm0 0V9"
                                        />
                                    </svg>
                                    <div className="ps-4 text-sm font-normal">{message.text}</div>
                                </div>
                            </div>
                        )}

                        {isCreate && (
                            <>
                                <div className="w-full h-[100vh] fixed top-0 left-0 bg-black/70" style={{zIndex: 100}}/>
                                <div ref={popupCreateRef} className="w-full fixed bottom-0 left-0 p-[10px]"
                                     style={{zIndex: 101}}>
                                    <div className="w-full bg-white rounded-lg p-5">
                                        <p className="font-bold text-[14px] mb-2">
                                            {extension.getLang("title_create")}
                                        </p>
                                        <p className="text-[12px] mb-5">
                                            {extension.getLang("description_title_create")}
                                        </p>

                                        <div className="w-full mb-5">
                                            <label
                                                htmlFor="website"
                                                className="block mb-2 text-[12px] font-medium text-gray-900"
                                            >
                                                {extension.getLang("label_website")} <span
                                                className={`text-red-500`}>*</span>
                                            </label>
                                            <input
                                                value={formState.website}
                                                onChange={(e) =>
                                                    setFormState((prev) => ({
                                                        ...prev,
                                                        website: e.target.value,
                                                        errors: {...prev.errors, website: ''},
                                                    }))
                                                }
                                                type="text"
                                                id="website"
                                                placeholder="example.com"
                                                className={`bg-gray-50 border ${formState.errors.website ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                                disabled={isLoading}
                                            />
                                            {formState.errors.website &&
                                                <p className="text-red-500">
                                                    {formState.errors.website}
                                                </p>
                                            }
                                        </div>
                                        <div className="w-full mb-5">
                                            <label
                                                htmlFor="account"
                                                className="block mb-2 text-[12px] font-medium text-gray-900"
                                            >
                                                {extension.getLang("label_account")} <span className={`text-red-500`}>*</span>
                                            </label>
                                            <input
                                                value={formState.account}
                                                onChange={(e) =>
                                                    setFormState((prev) => ({
                                                        ...prev,
                                                        account: e.target.value,
                                                        errors: {...prev.errors, account: ''},
                                                    }))
                                                }
                                                type="text"
                                                id="account"
                                                placeholder="example"
                                                className={`bg-gray-50 border ${formState.errors.account ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                                disabled={isLoading}
                                            />
                                            {formState.errors.account &&
                                                <p className="text-red-500">{formState.errors.account}</p>}
                                        </div>
                                        <div className="w-full mb-5">
                                            <label
                                                htmlFor="secret"
                                                className="block mb-2 text-[12px] font-medium text-gray-900"
                                            >
                                                {extension.getLang("label_secret_key")} <span className={`text-red-500`}>*</span>
                                            </label>
                                            <input
                                                value={formState.secret}
                                                onChange={(e) =>
                                                    setFormState((prev) => ({
                                                        ...prev,
                                                        secret: e.target.value,
                                                        errors: {...prev.errors, secret: ''},
                                                    }))
                                                }
                                                type="text"
                                                id="secret"
                                                placeholder="BK5V TVQ7 D2RB..."
                                                className={`bg-gray-50 border ${formState.errors.secret ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                                disabled={isLoading}
                                            />
                                            {formState.errors.secret && (
                                                <p className="text-red-500">
                                                    {formState.errors.secret}
                                                </p>
                                            )}
                                        </div>
                                        <div className="w-full flex justify-between">
                                            <div className="inline-block w-[59%]">
                                                <button
                                                    onClick={saveSecretKey}
                                                    className="h-[40px] w-full rounded-[10px] bg-blue-500 text-white px-5 disabled:opacity-50"
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? extension.getLang("button_create_running") : extension.getLang("button_create")}
                                                </button>
                                            </div>
                                            <div className="inline-block w-[39%]">
                                                <button
                                                    onClick={() => {
                                                        setIsCreate(false);
                                                        resetForm();
                                                    }}
                                                    className="h-[40px] w-full rounded-[10px] bg-gray-200 text-gray-900 px-5"
                                                    disabled={isLoading}
                                                >
                                                    {extension.getLang("button_cancel")}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtensionSidePanel;