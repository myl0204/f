import React, { PureComponent } from 'react';
import {
    Image,
    Animated,
    PanResponder,
    Text,
    Platform,
    TouchableWithoutFeedback,
    StyleSheet,
    Dimensions,
    View,
    ActivityIndicator,
    InteractionManager,
    Easing
} from 'react-native';
import FastImage from 'react-native-fast-image';
import debounce from 'lodash.debounce';
import * as Progress from 'react-native-progress'

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

const MOVE_THRESHOLD = 2;
const SINGLE_TAP_INTERVAL = 200;
const DEFAULT_SCALE_VALUE = 2;
const SCREEN_ASPECT_RATIO = SCREEN_WIDTH / SCREEN_HEIGHT;

/**
 * 距离转化缩放倍数
 * @returns {number} 缩放倍数，范围[0.6, 3]
 */

const distanceToScale = function(distance) {
    const result = distance / 250 + 1;
    return result < 0.6
        ? 0.6
        : result > 3
            ? 3
            : result;
};

/**
 * 计算2点距离
 * @param {object} p1 点1
 * @param {object} p2 点2
 * @param {number} p.x x坐标
 * @param {number} p.y y坐标
 */
const calculateDistanceBetween2Points = function(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
};

// export function Progress({progress}) {
//     return (
//         <View style={styles.progressContainer}>
//         {
//         Platform.OS === 'ios'
//             ? (
//             <View style={styles.progressWrapper}>
//                 <View style={[styles.progressContent, {width: `${progress * 100}%`}]}/>
//             </View>)
//             : <ActivityIndicator animating={progress < 1} size='large'/>
//         }
//         </View>
//     );
// }

export default class BigImage extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            progress: 0,
            error: false,
            diffDistance: new Animated.Value(0), // 单次
            totalDiffDistance: new Animated.Value(0), // 累计
            initDiffDistance: new Animated.Value(0),
            offsetX: new Animated.Value(0), // X轴偏移量, [-(scale - 1) / 2 * W, (scale - 1) / 2 * W] 不考虑中心点移动的情况下，下同
            offsetY: new Animated.Value(0) // Y轴偏移量, [-(scale - 1) * H / 2, (scale - 1) * H / 2]
        };
        this.startTime = 0;
        this.endTime = 0;
        this.total = 0;
        this.offset = new Animated.ValueXY({x: 0, y: 0});
        this._value = {x: 0, y: 0};
        this.offset.addListener(value => this._value = value);
        this.currentDistance = 0;
        this.initDistance = 0;
        this.tapCount = 0;
        this._panResponder = PanResponder.create({
            // Ask to be the responder:
            onStartShouldSetPanResponder: this.onStartShouldSetPanResponder,

            onPanResponderGrant: this.onPanResponderGrant,

            onPanResponderMove: this.onPanResponderMove,

            onPanResponderRelease: this.onPanResponderRelease,
      });
    }

    // componentWillMount() {
    //     this.getImageSize();
    // }
  
    // componentDidUpdate(prevProps) {
    //     if (this.props.targetUri !== prevProps.targetUri) {
    //         this.getImageSize();
    //     }
    // }

    onStartShouldSetPanResponder = (evt, gestureState) => true;

    onPanResponderGrant = ({nativeEvent,touchHistory}, gestureState) => {
        this.timer && clearTimeout(this.timer);
        this.props.clearAnimation();
        this.props.createAnimation();
        if (touchHistory.numberActiveTouches === 2) { // 缩放逻辑
            const pre = Platform.OS === 'ios' ? 1 : 0;
            const {startPageX: x1, startPageY: y1} = touchHistory.touchBank[0 + pre];
            const {startPageX: x2, startPageY: y2} = touchHistory.touchBank[1 + pre];
            this.startPoint1 = {x: x1, y: y1};
            this.startPoint2 = {x: x2, y: y2};
            this.middlePonit = {x: (this.startPoint1.x + this.startPoint2.x) / 2, y: (this.startPoint1.y + this.startPoint2.y) / 2};
            this.initDistance = calculateDistanceBetween2Points(this.startPoint1, this.startPoint2);
            this.currentDistance = this.initDistance;
        } else if (touchHistory.numberActiveTouches === 1) { // 移动逻辑
            this.startTime = nativeEvent.timestamp;
            this.initDistance = 0;
            this.currentDistance = this.initDistance;
            this.offset.setOffset({x: this._value.x, y: this._value.y});
            this.offset.setValue({x: 0, y: 0});
            this.tapCount++;
        }
    }

    onPanResponderMove = ({nativeEvent, touchHistory}, gestureState) => {
        if (touchHistory.numberActiveTouches === 2) {
            // this.touches = 2;
            const pre = Platform.OS === 'ios' ? 1 : 0;
            // 安卓端初始距离是会是0，两指“不可能”同一时间触屏。
            if (this.initDistance === 0) {
                const {startPageX: x1, startPageY: y1} = touchHistory.touchBank[0 + pre];
                const {startPageX: x2, startPageY: y2} = touchHistory.touchBank[1 + pre];
                this.startPoint1 = {x: x1, y: y1};
                this.startPoint2 = {x: x2, y: y2};
                this.initDistance = calculateDistanceBetween2Points(this.startPoint1, this.startPoint2);
                this.middlePonit = {x: (this.startPoint1.x + this.startPoint2.x) / 2, y: (this.startPoint1.y + this.startPoint2.y) / 2};
            
            }
            const {currentPageX: x1, currentPageY: y1} = touchHistory.touchBank[0 + pre];
            const {currentPageX: x2, currentPageY: y2} = touchHistory.touchBank[1 + pre];
            const currentPoint1 = {x: x1, y: y1};
            const currentPoint2 = {x: x2, y: y2};

            this.currentDistance = calculateDistanceBetween2Points(currentPoint1, currentPoint2);
            this.state.diffDistance.setValue(this.currentDistance - this.initDistance);
            // const {dx, dy} = gestureState;
            // const { x, y } = this.offset.__getValue();
            // const _x = x * this.scale;
            // const _y = y * this.scale;
            // const {x: px, y: py} = this.middlePonit; // 屏幕上点。
            // const offsetX = (1 - this.scale) * px + (this.scale - 1) * SCREEN_WIDTH / 2;
            // const offsetY = (1 - this.scale) * py + (this.scale - 1) * SCREEN_HEIGHT / 2;
            // gestureState.dx = offsetX;
            // gestureState.dy = offsetY;
            // this.moveImage({nativeEvent, touchHistory}, offsetX, offsetY);
            // console.warn(this.testS, 'test scale');
        } else if (touchHistory.numberActiveTouches === 1) { // 移动逻辑
            // if (this.touches === 2) {
            //     this.offset.extractOffset();
            //     this.touches = 1;
            // }
            const { dx, dy } = gestureState;
            this.moveImage({nativeEvent, touchHistory}, dx, dy);
        }
    }

    onPanResponderRelease = (evt, gestureState, normalRelease = true) => {
        const endTime = evt.nativeEvent.timestamp;
        const { diffDistance, totalDiffDistance } = this.state;
        if (endTime - this.endTime < 400 && this.tapCount === 2) {
            this.tapCount = 0;
            if (this.scale >= 0 && Math.round(this.scale, 4) < DEFAULT_SCALE_VALUE) {
                this.total = 250;
            } else {
                this.total = 0;
            }

            this.offset.flattenOffset();

            diffDistance.setValue(0);
            Animated.parallel([
                Animated.spring(totalDiffDistance, {
                    toValue: this.total
                }),
                Animated.spring(this.offset, {
                    toValue: {x: 0, y: 0}
                })
            ]).start();
        } else {
            this.endTime = endTime;
            const timediff = this.endTime - this.startTime;
            // single tap
            if (normalRelease && Math.abs(gestureState.dx) < MOVE_THRESHOLD && timediff < SINGLE_TAP_INTERVAL && evt.nativeEvent.changedTouches.length === 1) {
                this.timer && clearTimeout(this.timer);
                return this.timer = setTimeout(this.onImageTap, 200);   
            }

            this._onPanResponderRelease(evt, gestureState, normalRelease);
        }
    }

    _onPanResponderRelease = (evt, gestureState, normalRelease) => {
        normalRelease && this.props.clearAnimation();
        this.offset.flattenOffset();
        this.tapCount = 0;
        // 控制最大/最小缩放倍数
        const { diffDistance, totalDiffDistance } = this.state;
        this.total += (this.currentDistance - this.initDistance);
        diffDistance.setValue(0);
        this.total = this.total < 0
            ? 0
            : this.total > 500
                ? 500
                : this.total;
        totalDiffDistance.setValue(this.total);
        

        const { xRange, yRange } = this.calculateAvailableMoveRange();
        let {x, y} = this.offset.__getValue();
        
        const xValue = xRange < 0
            ? 0
            : Math.abs(x) > xRange
                ? Math.sign(x) * xRange
                : x;
        const yValue = yRange < 0
            ? 0
            : Math.abs(y) > yRange
                ? Math.sign(y) * yRange
                : y;

        // 位置回弹。
        // this.offset.setValue({x: xValue, y: yValue});
    
        // flip
        if (Math.abs(gestureState.vx) > 0.3 && !gestureState.isBack) {
            const distance = gestureState.vx * gestureState.dx * 2;
            const sign = Math.sign(gestureState.vx);
            const _distance = distance / this.scale;
            const toValue = sign > 0 ? Math.min(xValue - _distance, xRange) : Math.max(xValue + _distance, -xRange);

            Animated.spring(this.offset.x, {
                velocity: gestureState.vx * 2,
                toValue: sign > 0 ? Math.min(xValue + _distance, xRange) : Math.max(xValue - _distance, -xRange),
                friction: 15,
                tension: 50
            }).start();
        }
    }
  
    get scale() {
        const { diffDistance, totalDiffDistance, initDiffDistance } = this.state;
        const totalDiff = Animated.add(diffDistance, totalDiffDistance);
        return Animated.add(totalDiff, initDiffDistance).interpolate({
            inputRange: [-1000, -100, 0, 100],
            outputRange: [0.6, 0.6, 1, 1.4]
        }).__getValue();
    }
  
    /**
     * 重置图片状态
     */
    resetImage = () => {
        this.offset.flattenOffset();
        const { diffDistance, totalDiffDistance } = this.state;
        this.offset.setValue({x: 0, y:0});
        diffDistance.setValue(0);
        totalDiffDistance.setValue(0);
        this.total = 0;
    }

    /**
     * 单击图片回调
     */

    onImageTap = () => {
        this.timer && clearTimeout(this.timer);
        const { clearAnimation, onPress, showStatus, test } = this.props;
        this.tapCount = 0;
        this.resetImage();
        clearAnimation && clearAnimation();
        if (showStatus !== 4) {
            return test && test();
        }
        onPress && onPress();
    }

    /**
     * 图片移动函数
     */
    moveImage = (evt, dx, dy) => {
        const {x, y} = this.offset.__getValue();
        const initOffsetX = this.offset.x._offset;
        const initOffsetY = this.offset.y._offset;
        const { xRange, yRange } = this.calculateAvailableMoveRange();
        // const { dx, dy, vx, vy } = gestureState;
        let _x = dx / this.scale;
        let _y = Math.abs(dy / this.scale) < MOVE_THRESHOLD ? 0 : dy / this.scale;
        // 移动偏移 + 初始 === 总偏移 （相对于中心）  _x + x

        // 移动偏移max === 总偏移 - 初始。
        // _x - 初始 = x
        // 初始 + 当前 = 总。
        // 2 * _x - x < xrange 2 * _x -x - range

        // 解决左右两端图片可以拉出黑边
        const currentOffsetX = _x + initOffsetX;
        const currentOffsetY = _y + initOffsetY;     
        const xValue = Math.abs(currentOffsetX) <= xRange ? _x : Math.sign(dx) * xRange - initOffsetX;
        const yValue = Math.abs(currentOffsetY) <= yRange ? _y : Math.sign(dy) * yRange - initOffsetY;


        if (Math.abs(x) <= xRange && Math.abs(y) <= yRange) { // 在可移动范围内
            this.offset.setValue({x: xValue, y: yValue});
        } else if (Math.abs(x) <= xRange) {
            this.offset.x.setValue(xValue);
        } else if (Math.abs(y) <= yRange) {
            this.offset.y.setValue(yValue);
        }
    }
    
    /**
     * 获取图片水平方向上可移动距离
     * @returns {object} {left, right}
     */
    getHorizontalRange = () => {
        const { x } = this.offset.__getValue();
        const { xRange } = this.calculateAvailableMoveRange();
        const result = {};
        result.left = -x + xRange;
        result.right = x + xRange;
        return result;
    }

    // getImageSize = () => {
    //     Image.getSize(this.props.targetUri, (w, h) => {
    //         this.width = w;
    //         this.height = h;
    //         this.aspectRatio = w / h;
    //         if (this.aspectRatio < SCREEN_ASPECT_RATIO) {
    //             this.setInitialScale();
    //         }
    //     }, () => {
    //         this.w = 0;
    //         this.h = 0;
    //         this.aspectRatio = 0;
    //     });
    // }

    /**
     * 设置图片初始缩放，使图片宽度撑满屏幕
     * 在图片宽高比小于设备宽高比时调用。
     */

    setInitialScale = () => {
        // const scale = SCREEN_WIDTH / this.w;
        const scale = SCREEN_ASPECT_RATIO / this.aspectRatio;
        this.state.initDiffDistance.setValue((scale - 1) * 250);
    }

    /**
     * 计算图片最大可移动距离
     * @returns {object} {xRange, yRange}
     */

    calculateAvailableMoveRange = () => {
        let xRange, yRange;
        if (this.aspectRatio === 0 || this.aspectRatio === undefined) {
            xRange = 0;
            yRange = 0;
        } else if (this.aspectRatio >= SCREEN_ASPECT_RATIO) {
            xRange = (this.scale - 1) * SCREEN_WIDTH / 2 / this.scale;
            yRange = ((SCREEN_WIDTH * this.scale) / this.aspectRatio - SCREEN_HEIGHT) / 2 / this.scale;
        } else { 
            xRange = (this.scale * this.aspectRatio * SCREEN_HEIGHT - SCREEN_WIDTH) / 2 / this.scale;
            yRange = (this.scale - 1) * SCREEN_HEIGHT / 2 / this.scale;
        }
        return {xRange, yRange};
    }

    onLoadStart = ({nativeEvent}) => {
        // console.log(nativeEvent)
        // console.log('load start', this.props.targetUri, this.props.thumbnail, this.props.showStatus);
    }

    onProgress = ({nativeEvent: {loaded, total}}) => {
        const { showStatus, onProgress } = this.props;
        const progress = loaded / total;
        if (showStatus < 4) {
            onProgress && onProgress(progress);
        } else {
            this.updateProgress(progress);
            // debounce(() => {
            //     console.log('setState');
            //     this.setState({ progress })
            // }, 5)
        }
    }

    updateProgress = debounce((progress) => {
        console.log('update')
        this.setState({progress})
    }, 1)
    // onProgress = debounce(event => {
    //     event.persist();
    //     console.log(event.nativeEvent, 'abc')
    //     // {nativeEvent: {loaded, total}}
    //     // const { showStatus, onProgress } = this.props;
    //     // const progress = loaded / total;
    //     // if (showStatus < 4) {
    //     //     onProgress && onProgress(progress);
    //     // } else {
    //     //     this.setState({ progress });
    //     // }
    // }, 50);
  
    renderProgress = () => {
        const { progress } = this.state;
        return progress !== 1 && <Progress.Pie progress={progress}/>;
    }
  
    onLoad = ({nativeEvent}) => {
        const { showStatus, onLoad, afterShowImage, index } = this.props;
        this.setState({error: false});
        // if (!thumbnail) {
        onLoad && onLoad(nativeEvent, index);
        if (showStatus === 2 && afterShowImage) {
            afterShowImage();
        }
        // }
    }
  
    onLoadEnd = (ev) => {
        if (this.props.targetUri === 'data:') return;
        this.setState({progress: 1});
    }
  
    onError = (error) => {
        if (this.props.targetUri !== 'data:' && this.props.showStatus > 1) {
            this.setState({error: true});
        }
    }
  
    render() {
        const {
            position,
            width,
            height,
            offsetX,
            offsetY,
            imageOpacity,
            onPress,
            targetUri,
            showStatus,
            resizeMode,
            opacity,
            imageScale,
            containerScale
        } = this.props;
        const { diffDistance, totalDiffDistance, error, initDiffDistance } = this.state;
        const totalDiff = Animated.add(diffDistance, totalDiffDistance);
        const scale = Animated.add(initDiffDistance, totalDiff).interpolate({
            inputRange: [-1000, -100, 0, 100],
            outputRange: [0.6, 0.6, 1, 1.4]
        });

        // console.log('renderBigImage');

        return (
            <Animated.View
                style={[styles.animationContainer, { position, width, height, left: offsetX, top: offsetY, opacity: imageOpacity }]}
            >
                <Animated.Image
                    // targetUri={showStatus > 1 ? targetUri : 'data:'}
                    // scale={showStatus < 4 ? imageScale : scale}
                    // offset={this.offset}
                    source={{uri: showStatus > 1 ? targetUri : 'data:'}}
                    style={[
                        styles.img,
                        { transform: [{ scale: showStatus === 4 ? scale : imageScale }, ...this.offset.getTranslateTransform()] },
                    ]}
                    onProgress={this.onProgress}
                    onLoadStart={this.onLoadStart}
                    onLoad={this.onLoad}
                    onLoadEnd={this.onLoadEnd}
                    onError={this.onError}
                    resizeMode={resizeMode}
                />
                {showStatus === 4 && !error && this.renderProgress()}
                {error && <Image source={require('../static/fail.png')}/>}
            </Animated.View>
        )
    }
}

export class TransformImage extends PureComponent {
    render() {
        const {
            position,
            width,
            height,
            imageOpacity,
            targetUri,
            resizeMode,
            imageScale,
            containerScale,
            offset
        } = this.props;

        return (
            <Animated.View
                style={[
                    styles.animationContainer,
                    {
                        transform: [{scale: containerScale}]
                    },
                    {
                        position,
                        width,
                        height,
                        left: offset.x,
                        top: offset.y,
                    }
                ]}
            >
                <Animated.Image
                    source={{uri: targetUri}}
                    style={[
                        styles.img,
                        { transform: [{ scale: imageScale }] },
                    ]}
                    // onProgress={this.onProgress}
                    // onLoadStart={this.onLoadStart}
                    // onLoad={this.onLoad}
                    // onLoadEnd={this.onLoadEnd}
                    // onError={this.onError}
                    resizeMode={resizeMode}
                />
                {/* {error && <Image source={require('../static/fail.png')}/>} */}
            </Animated.View>
        )
    }
}


const styles = StyleSheet.create({
    animationContainer: {
        flex: 1,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    img: {
        width: '100%',
        height: '100%',
        // resizeMode: 'contain',
        position: 'absolute',
    },
    progressContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center'
    },
    progressWrapper: {
        width: '60%',
        height: 10,
        borderRadius: 5,
        borderColor: 'white',
        borderWidth: 2,
    },
    progressContent: {
        position: 'absolute',
        height: '100%',
        backgroundColor: 'white'
    }
});
