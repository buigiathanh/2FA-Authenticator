/*global chrome*/
import { useEffect, useState } from "react"; 
import styles from "./index.module.scss"
import jsQR from "jsqr";
import {extension} from "../../../../utils/chrome";

const ScanQRCode = () => {
    const [tab, setTab] = useState();
    const [captureImage, setCaptureImage] = useState(false);
    const [imageCapture, setImageCapture] = useState();
    const [showSelection, setShowSelection] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [endX, setEndX] = useState(0);
    const [endY, setEndY] = useState(0);
    const [styleSection, setStyleSection] = useState({})

    const handleStartCapture = async (tab) => {
        const dataResponse = await chrome.runtime.sendMessage({action: "capture", data: {tab}});
        if (dataResponse.status) {
            const dataImage = dataResponse.data.image;
            setImageCapture(dataImage);
            setCaptureImage(true);

        }
    }

    useEffect(() => {
        const minX = Math.min(...[startX, endX]);
        const maxX = Math.max(...[startX, endX]);
        const minY = Math.min(...[startY, endY]);
        const maxY = Math.max(...[startY, endY]);
        setStyleSection({...styleSection, ...{
            top: minY + "px",
            left: minX +"px",
            width: (maxX - minX) + "px",
            height: (maxY - minY) + "px"
        }})
    }, [startX, startY, endX, endY])

    useEffect(() => {
        if (!showSelection) return;

        const selection = document.getElementById("hJHUhgh__selection");
        const overlay = document.getElementById("Yudeyus__overlay");

        if (!selection || !overlay) {
            return;
        }

        const handleSetSize = (e) => {
            setEndX(e.pageX);
            setEndY(e.pageY);
        };

        const handleMouseUp = () => {
            overlay.removeEventListener("mousemove", handleSetSize);
            overlay.removeEventListener("mouseup", handleMouseUp);

            const rect = selection.getBoundingClientRect();

            setCaptureImage(false);
            setShowSelection(false);
            setStartX(0);
            setStartY(0);
            setEndX(0);
            setEndY(0);

            if (!imageCapture) {
                console.error("Không có dữ liệu ảnh chụp");
                return;
            }

            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageCapture;

            img.onload = async () => {
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                const scaleX = imgWidth / viewportWidth;
                const scaleY = imgHeight / viewportHeight;


                const adjustedX = (rect.left + window.scrollX) * scaleX;
                const adjustedY = (rect.top + window.scrollY) * scaleY;
                const adjustedWidth = rect.width * scaleX;
                const adjustedHeight = rect.height * scaleY;


                const canvas = document.createElement('canvas');
                canvas.width = rect.width;
                canvas.height = rect.height;
                const context = canvas.getContext('2d');


                context.drawImage(
                    img,
                    adjustedX,
                    adjustedY,
                    adjustedWidth,
                    adjustedHeight,
                    0,
                    0,
                    rect.width,
                    rect.height
                );

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const imageUrl = canvas.toDataURL("image/png");


                const code = jsQR(imageData.data, canvas.width, canvas.height);
                if (code) {
                    const dataQRCode = code.data;
                    if (dataQRCode.startsWith("otpauth")) {
                        const urlDecode = decodeURIComponent(dataQRCode);
                        const strCode = urlDecode.replace("otpauth://totp/", "");
                        const [accountPart, query] = strCode.split("?");
                        const account = accountPart.split(":")[1];
                        const params = new URLSearchParams(query);
                        const { secret, issuer } = Object.fromEntries(params.entries());
                        let secretKeys = await extension.storage.getItem("list_secret_key_2fa");
                        secretKeys = typeof secretKeys === "string" ? JSON.parse(secretKeys) : [];
                        secretKeys = secretKeys.concat([{
                            website: issuer,
                            account: account,
                            secretKey: secret
                        }])

                        await extension.storage.setItem("list_secret_key_2fa", JSON.stringify(secretKeys))
                    }
                } else {
                    console.log("Không tìm thấy mã QR.");
                }
            };

            img.onerror = () => console.error("Không thể tải ảnh do lỗi CORS hoặc nguồn không hợp lệ");
        };

        overlay.addEventListener('mousemove', handleSetSize);
        overlay.addEventListener('mouseup', handleMouseUp);

        return () => {
            overlay.removeEventListener('mousemove', handleSetSize);
            overlay.removeEventListener('mouseup', handleMouseUp);
        };
    }, [showSelection, imageCapture, setEndX, setEndY, setCaptureImage, setShowSelection, setStartX, setStartY]);

    useEffect(() => {
        if (captureImage) {
            const overlay = document.getElementById("Yudeyus__overlay");
            if (overlay) {
                const setOptionSelection = (e) => {
                    setStartX(e.pageX);
                    setStartY(e.pageY);
                    setEndX(e.pageX);
                    setEndY(e.pageY)
                    setShowSelection(true);
                }

                overlay.addEventListener('mousedown', setOptionSelection);

                return () => overlay.removeEventListener("mousedown", setOptionSelection)
            }
        }
    }, [captureImage])

    useEffect(() => {
        chrome.runtime.onMessage.addListener((req, sender, res) => {
            if (req.action === 'captureSelection') {
                handleStartCapture(req.data.tab).then();
                setTab(req.data.tab);
                res({status: true})
            }
        });
    }, [])

    return (
        <>
            {
                captureImage && (
                    <>
                        <div
                            id="Yudeyus__overlay"
                            className={styles.screenshotOverlay}
                        />

                        <div
                            id="Yudeyus__overlay_t"
                            className={styles.overlay}
                            style={{width: "100%", height: Math.min(...[startY, endY]) + "px", top: 0, left: 0}}
                        />

                        <div
                            id="Yudeyus__overlay_r"
                            className={styles.overlay}
                            style={{width: `calc(100% - ${Math.max(...[startX, endX])}px)`, height: `${Math.max(...[startY, endY]) - Math.min(...[startY, endY])}px`, top: Math.min(...[startY, endY]) + "px", right: 0}}
                        />

                        <div
                            id="Yudeyus__overlay_b"
                            className={styles.overlay}
                            style={{width: "100%", height: `${document.body.offsetHeight - Math.max(...[startY, endY])}px`, left: 0, top: `${Math.max(...[startY, endY])}px`}}
                        />

                        <div
                            id="Yudeyus__overlay_l"
                            className={styles.overlay}
                            style={{width: `${Math.min(...[startX, endX])}px`, height: `${Math.max(...[startY, endY]) - Math.min(...[startY, endY])}px`, left: 0, top: Math.min(...[startY, endY]) + "px"}}
                        />
                    </>
                )
            }

            {
                showSelection && (
                    <div
                        id="hJHUhgh__selection"
                        className={styles.selection}
                        style={styleSection}
                    />
                )
            }
        </>
    )
}

export default ScanQRCode
