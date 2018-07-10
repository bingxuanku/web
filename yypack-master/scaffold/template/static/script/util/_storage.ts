const storage = {
    setItem(name,value,days) {
        let expires = '';
        if (days) {
            let date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            expires = "; expires="+date.toUTCString();
        }
        document.cookie = name+"="+encodeURIComponent(value)+expires+"; path=/";
    },
    getItem(name) {
        let arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");

        if(arr=document.cookie.match(reg)){
            return decodeURIComponent(arr[2]);
        }else{
            return '';
        }
    },
    removeItem(name) {
        this.setItem(name,"",-1);
    }
}

export default storage