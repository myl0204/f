import React from 'react';
import ImageGallery from '../index';

const urls = [
    'http://i.imgur.com/XP2BE7q.jpg',
    'http://i.imgur.com/5nltiUd.jpg',
    'http://i.imgur.com/6vOahbP.jpg',
    'http://i.imgur.com/kj5VXtG.jpg'
]
export default class Demo extends React.Component {
    render() {
        return (
            <ImageGallery
                urls={urls}
                withoutStaticImage={false}
                style={{width: 200, height: 200}}
                source={{uri: 'http://i.imgur.com/XP2BE7q.jpg'}}
            />
        )
    }
}