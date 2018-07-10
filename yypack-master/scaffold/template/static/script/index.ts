declare let Vue, VueRouter,require;

require('./util/_media');
require('./component/_component');

//全局变量
let storage = require('./util/_storage');
Vue.prototype.storage = storage;




//路由组件
import home from  '../html/home/page'


Vue.use(VueRouter);

const routes = [
    {path: '/', component : home}

];
const router = new VueRouter({
    routes
})
new Vue({
    el:'#app',
    router,
});

