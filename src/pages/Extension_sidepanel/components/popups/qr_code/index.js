import {settingStore} from "../../../../../mobx/setting.store";
import {useClickOutside} from "../../../../../hooks/useClickOutside";
import {useRef} from "react";
import {secretKeyStore} from "../../../../../mobx/secret_key.store";
import {observer} from "mobx-react-lite";

const PopupQRCode = () => {
    const ref = useRef(null);

    useClickOutside(ref, () => {
        settingStore.popup = ""
    });

    return (
        <>
            {
                settingStore.popup === "qr_code" && secretKeyStore.link_qr_code.length > 0 && (
                    <>
                        <div className="w-full h-[100vh] fixed top-0 left-0 bg-black/70" style={{zIndex: 100}}/>
                        <div
                            ref={ref}
                            className="fixed bg-white rounded-lg top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] w-[250px] h-auto p-[10px]"
                            style={{zIndex: 101}}
                        >
                            <img
                                src={secretKeyStore.link_qr_code}
                                className="w-full h-auto mx-auto"
                                alt="QR Code"
                            />
                        </div>
                    </>
                )
            }
        </>
    )
}

export default observer(PopupQRCode)