import React, { PureComponent } from 'react';
import {
    FlatList,
    View,
    Animated,
    Text,
    StyleSheet,
    Dimensions,
    Platform,
    PanResponder,
    InteractionManager
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SCROLL_STATUS_SCROLLING = 'scrolling';
const SCROLL_STATUS_IDLE = 'idle';

export default class ViewPager extends PureComponent {
    constructor(props) {
        super(props);
        // scroller容器
        this._panResponder = PanResponder.create({
            // Ask to be the responder:
            onStartShouldSetPanResponder: (evt, gestureState) => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => true,
            onPanResponderGrant: this.onPanResponderGrant,
            onPanResponderMove: this.onPanResponderMove,
            onPanResponderTerminationRequest: this.onPanResponderTerminationRequest,
            onPanResponderRelease: this.onPanResponderRelease,
            onPanResponderTerminate: this.onPanResponderRelease,
            onShouldBlockNativeResponder: this.onShouldBlockNativeResponder,
        });
    }

    timer = null;

    scrollStatus = SCROLL_STATUS_IDLE;

    contentOffset = 0;

    componentWillUnmount() {
        this.timer && clearTimeout(this.timer);
    }

    onPanResponderMove = (evt, gestureState) => {
        const diff = this.getContentOffsetFromCurrentImage();
        const { dx, dy } = gestureState;
        const { currentImage, source } = this.props;
        if (currentImage === 0 && dx > 0 && diff > 0 || currentImage === source.length - 1 && dx < 0 && diff < 0) {
            return;
        }
        this.updateContentOffset({offset: -dx, isFinish: false, animated: false});
    }

    onPanResponderGrant = () => {
        this.scrollStatus = SCROLL_STATUS_SCROLLING;
    }

    onPanResponderTerminationRequest = (evt, gestureState) => true

    onPanResponderRelease = (evt, gestureState, isFinish) => {
        this.scrollStatus = SCROLL_STATUS_IDLE;
        if (!isFinish) return;
        const { currentImage, source, imageRefs } = this.props;
        const bigImage = imageRefs.get(currentImage);
        let offset;
        if (gestureState.dx < 0 && currentImage < source.length - 1 && (-gestureState.dx > 0.4 * SCREEN_WIDTH || -gestureState.vx > 0.5)) {
            // 下一页
            offset = (currentImage + 1) * SCREEN_WIDTH;
            gestureState.isBack = false;
        } else if (gestureState.dx > 0 && currentImage > 0 && (gestureState.dx > 0.4 * SCREEN_WIDTH || gestureState.vx > 0.5)) {
            // 上一页
            offset = (currentImage - 1) * SCREEN_WIDTH;
            gestureState.isBack = false;
        } else {
            offset = currentImage * SCREEN_WIDTH;
            gestureState.isBack = true;
            bigImage._onPanResponderRelease(evt, gestureState);
        }

        if (!gestureState.isBack) {
            InteractionManager.runAfterInteractions(() => {
                bigImage.resetImage();
            });
        }
        this.updateContentOffset({offset});
    }

    onShouldBlockNativeResponder = (evt, gestureState) => {
        // Returns whether this component should block native components from becoming the JS
        // responder. Returns true by default. Is currently only supported on android.
        return true;
    }

    updateContentOffset = ({offset, isFinish = true, animated = true}) => {
        const { currentImage } = this.props;
        const offsetX = isFinish ? 0 : currentImage * SCREEN_WIDTH;
        this.contentOffset = offset + offsetX;
        this.scrollView.scrollToOffset({offset: this.contentOffset, animated});

        // for android bug (maybe), see: https://github.com/facebook/react-native/issues/21718
        // 安卓端主动触发scrollend
        if (Platform.OS === 'android') {
            this.timer && clearTimeout(this.timer);
            this.timer = isFinish && animated && setTimeout(() => {
                this.props.onScrollEnd({nativeEvent: {contentOffset: { x: this.contentOffset }}});
            }, 200);
        }
    }

    /**
     * 获取容器偏移量。
     */
    getContentOffsetFromCurrentImage = () => {
        return this.props.currentImage * SCREEN_WIDTH - this.contentOffset;
    }

    _keyExtractor = (item, index) => item.uri;

    render() {
        const {
            currentImage,
            source,
            // opacity,
            scrollViewRef,
            scrollContainerBg,
            renderItem,
            onScrollEnd,
            initialIndex
        } = this.props;

        // const containerBackgroundColor = opacity.interpolate(
        //     {
        //       inputRange: [ 0, 0.2, 0.4, 0.6, 0.8, 1 ],
        //       outputRange: [ 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, .2)', 'rgba(0, 0, 0, .4)', 'rgba(0, 0, 0, .6)', 'rgba(0, 0, 0, .8)', 'rgba(0, 0, 0, 1)' ]
        //     });
        
        return (
            <Animated.View
                // style={[styles.scrollContainer, { backgroundColor: containerBackgroundColor}]}
                style={[styles.scrollContainer]}
            >
                <FlatList
                    scrollEnabled={false}
                    ref={view => this.scrollView = view}
                    horizontal={true}
                    style={{backgroundColor: scrollContainerBg}}
                    onMomentumScrollEnd={onScrollEnd}
                    initialScrollIndex={initialIndex}
                    // contentOffset={contentOffset}
                    data={source}
                    renderItem={renderItem}
                    keyExtractor={this._keyExtractor}
                    getItemLayout={(data, index) => ({
                        length: data.length,
                        offset: SCREEN_WIDTH * index,
                        index
                    })}
                />
                {this.props.children}
            </Animated.View>
        );
    }
}

const styles = StyleSheet.create({
    scrollContainer: {
    //   flex: 1,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    //   position: 'absolute',
      zIndex: 30,
    }
});

