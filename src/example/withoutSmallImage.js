import React from 'react';
import { Text, TouchableOpacity, View, Image } from 'react-native';
import ImageGallery from '../index';

const urls = [
    'http://i.imgur.com/XP2BE7q.jpg',
    'http://i.imgur.com/5nltiUd.jpg',
    'http://i.imgur.com/6vOahbP.jpg',
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

    showImage = (index) => {
        console.log(this.image0, 'image1');
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

    render() {
        return (
            <View>
                <ImageGallery
                    urls={urls}
                    show={this.state.show}
                    onHide={this.onImageHide}
                    smallImage={this.state.imageInstance}
                    initialIndex={this.state.initialIndex}
                    lazyLoad={false}
                />
                {/* some other component */}
                <View style={{flexDirection: 'row'}}>
                    {
                        urls.map((uri, index) => (
                            <TouchableOpacity
                                onPress={() => this.showImage(index)}
                                key={uri}
                            >
                                <Image
                                    source={{uri}}
                                    style={{width: 100, height: 100}}
                                    ref={view => this['image' + index] = view}
                                />
                            </TouchableOpacity>
                        ))
                    }
                </View>
                
            </View>
            
        )
    }
}