import * as React from "react";
import styles from "./Disable.module.css";

const Disable = ({ disabled, children }) => {

    const layerRef = React.useRef(null);
    const childRef = React.useRef(null);

    React.useEffect(() => {
        // Need to delay it for the first time
        if (disabled) {
            setTimeout(() => {
                layerRef.current.style.width = childRef.current.clientWidth + "px";
                layerRef.current.style.height = childRef.current.clientHeight + "px";
                childRef.current.style.opacity = '0.4';
            }, 0);
        }
        else {
            layerRef.current.style.display = 'none';
            childRef.current.style.opacity = '1';
        }
    });

    return (
        <>
            <div className={styles.layer} ref={layerRef}></div>
            <div className={styles.child} ref={childRef}>
                {children}
            </div>
        </>
    );
};

export default Disable;
