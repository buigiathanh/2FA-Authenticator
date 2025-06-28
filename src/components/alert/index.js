import IconBell from "../icons/bell";
import {settingStore} from "../../mobx/setting.store";
import {observer} from "mobx-react-lite";
import {useEffect} from "react";

const AlertComponent = () => {
    const isShow = settingStore.alert.show;

    useEffect(() => {
        let idTimeout
        if (isShow) {
            idTimeout = setTimeout(() => {
                settingStore.alert = {title: "", type: "", show: false}
            }, 2000)
        }

        return () => clearTimeout(idTimeout)
    }, [isShow])

    return (
        <>
            {
                isShow && (
                    <div className="p-[10px] w-full fixed bottom-0 left-0">
                        <div
                            className="flex items-center w-full p-4 space-x-4 rtl:space-x-reverse text-gray-500 bg-white divide-x rtl:divide-x-reverse divide-gray-200 rounded-lg shadow"
                            role="alert"
                        >
                            <IconBell cname={"w-5 h-5 text-blue-600"}/>
                            <div className="ps-4 text-sm font-normal">{settingStore.alert.title}</div>
                        </div>
                    </div>
                )
            }
        </>
    )
}

export default observer(AlertComponent)