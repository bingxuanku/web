
(function() {
    var rem, dpr, time, doc = window.document,
        docEl = doc.documentElement,
        viewport = doc.querySelector('meta[name="viewport"]'),
        zoomScale,
        zoomScaleNum;
    if (viewport) {
        //console.warn("将根据已有的meta标签来设置缩放比例");
        zoomScale = viewport.getAttribute("content").match(/initial\-scale=(["']?)([\d\.]+)\1?/);
        if(zoomScale){
            zoomScaleNum = parseFloat(zoomScale[2]);
            dpr = parseInt(1 / zoomScaleNum);
        }
    }
    if (!dpr && !zoomScaleNum) {
        // console.warn(“根据未设置meta标签来缩放比例”)
        var os = (window.navigator.appVersion.match(/android/gi), window.navigator.appVersion.match(/iphone/gi)),
            dpr = window.devicePixelRatio;
        dpr = os ? dpr >= 3 ? 3 : dpr >= 2 ? 2 : 1 : 1;
        zoomScaleNum = 1 / dpr;
    }
    window.addEventListener("resize",
        function() {
            clearTimeout(time);
            time = setTimeout(changeRem, 300);
        },false);

    //改变基准rem
    function changeRem(){
        var docWidth = docEl.getBoundingClientRect().width;
        // 540 1080P
        // if(docWidth / dpr > 540){
        //     docWidth = 540 * dpr;
        // }
        rem = docWidth/360 * 16;
        docEl.style.fontSize = rem + "px";
    }
    changeRem();
})();
