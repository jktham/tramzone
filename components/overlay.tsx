import { Feature } from "ol";
import { forwardRef } from "react";

const PopUpWindow = forwardRef(function PopUpWindow({feature}: Feature, ref) {
    const values = feature.values_;
    const type = values.type;
    let name;

    if (type === "tram") {
        name = values.route_name;
    }
    if (type === "station") {
        name = values.name;
    }
    if (type === "line") {
        name = values.name;
    }
    
    return (
        <>
        <div ref={ref}>{name}</div>
        </>
    );
});
export default PopUpWindow;
