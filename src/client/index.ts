import Vue from 'vue'

import Home from './components/home.vue'

// tslint:disable-next-line no-unused-expression
new Vue({
    el: '#app',
    template: `
    <div>
        Name: <input v-model="name" type="text">
        <h1>Hello Component</h1>
        <Home :name="name" :initialEnthusiasm="5" />
    </div>
    `,
    data: { name: 'World' },
    components: {
        Home,
    },
})

import * as socketIO from 'socket.io-client'

const io = socketIO()

io.on('connect', () => {
    console.log('connect')
})