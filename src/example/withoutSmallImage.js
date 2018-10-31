import React from 'react';
import { Text, TouchableOpacity, View, Image } from 'react-native';
import ImageGallery from '../index';

// const urls = [
//     'http://ww1.sinaimg.cn/large/8f78f96fly1fwp5pzad6ej23402c0u10.jpg',
//     'http://ww1.sinaimg.cn/large/8f78f96fly1fwp5vvd912j22bc1jme82.jpg',
//     'http://ww1.sinaimg.cn/large/8f78f96fly1fwp5wokycoj22bc1jmqv5.jpg'
// ]

const urls = [
    // 'http://i.imgur.com/XP2BE7q.jpg',
    // 'http://i.imgur.com/5nltiUd.jpg',
    // 'http://i.imgur.com/6vOahbP.jpg',
    'http://ww1.sinaimg.cn/large/8f78f96fly1fwp5wokycoj22bc1jmqv5.jpg'
]

const weiboUrls = [
    // 'http://i.imgur.com/XP2BE7q.jpg',
    // // 'http://ww1.sinaimg.cn/thumbnail/8f78f96fly1fwp5vvd912j22bc1jme82.jpg',
    // 'http://i.imgur.com/5nltiUd.jpg',
    'http://ww1.sinaimg.cn/thumbnail/8f78f96fly1fwp5wokycoj22bc1jmqv5.jpg'
]
export default class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            show: false,
            initialIndex: 0,
            imageInstance: ''
        }
    }

    imageInstances = new Map();

    showImage = (index) => {
        this.setState({initialIndex: index, imageInstance: this['image' + index]}, () => this.setState({show: true}));
    }

    hideImage = () => {
        this.setState({show: false})
    }

    onImageHide = () => {
        this.hideImage();
        console.log('image hides~');
    }

    // imageRefs = (view, index) => {
    //     this[`image#${index}`] = view
    // }

    getImageInstance = () => {
        return this.imageInstances;
    }

    render() {
        return (
            <View>
                <ImageGallery
                    urls={urls}
                    thumbnailUrls={weiboUrls}
                    show={this.state.show}
                    onHide={this.onImageHide}
                    // smallImage={this.state.imageInstance}
                    getImageInstance={this.getImageInstance}
                    initialIndex={this.state.initialIndex}
                    lazyLoad={true}
                    withoutStaticImage={true}
                />
                {/* some other component */}
                <View style={{flexDirection: 'row'}}>
                    {
                        weiboUrls.map((uri, index) => (
                            <TouchableOpacity
                                onPress={() => this.showImage(index)}
                                key={uri}
                            >
                                <Image
                                    source={{uri}}
                                    style={{width: 100, height: 100}}
                                    ref={view => {
                                        this['image' + index] = view;
                                        view && this.imageInstances.set(index, view);
                                    }}
                                />
                            </TouchableOpacity>
                        ))
                    }
                </View>

                {/* {this.state.show && <Image source={{uri: urls[0]}} style={{height: 818, width: 375, position: 'absolute', top: 0, left: 0}} />} */}
                
            </View>
            
        )
    }
}