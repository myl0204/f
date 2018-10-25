// https://github.com/facebook/react-native/issues/12152 图片警告问题
import React, { PureComponent } from 'react';
import {
  Image,
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
  Modal,
  Easing,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PanResponder,
  InteractionManager,
  FlatList,
  SafeAreaView
} from 'react-native';
import ViewPager from './ViewPager';
import BigImage from './BigImage';
import PropTypes from 'prop-types';
// import DeviceInfo from 'react-native-device-info';
// import DLShareModule from '@ecool/react-native-sharelib';
// import { ActionSheet } from '@ecool/react-native-ui';

// for ios only
// const STATUS_BAR_HEIGHT = DeviceInfo.getModel().includes('iPhone X')
//   ? 0
//   : 20;

const STATUS_BAR_HEIGHT = 0;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const MOVE_THRESHOLD = 2;
const SCROLL_STATUS_SCROLLING = 'scrolling';

export default class ImageGallery extends PureComponent {
    static propTypes = {
        // 图片源
        urls: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.string,
            PropTypes.arrayOf(function(prop, key, componentName, location, propFullName) {
                if (!(typeof prop[key] === 'number' || typeof prop[key] === 'string')) {
                    return new Error(`Invalid prop "${propFullName}" supplied to "${componentName}". Item in array should be string or number`);
                }
            })
        ]).isRequired,
        // 缩略图
        source: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.string
        ]),
        // 是否懒加载
        lazyLoad: PropTypes.bool,
        style: PropTypes.object,
        defaultSource: PropTypes.string,
        // 原本的状态栏颜色，当changeStatusBarColor为true时有效。
        // statusBarColor: PropTypes.string,
        // // 是否改变状态栏颜色，
        // changeStatusBarColor: PropTypes.bool,
        // 自定义动画时间
        transitionDuration: PropTypes.number,
        // 是否显示缩略图
        thumbnail: PropTypes.bool,
        // 是否开启缩略图选中
        editable: PropTypes.bool,
        // 初始图片
        initialIndex: PropTypes.number,
        // 无静态图模式
        withoutStaticImage: PropTypes.bool,
        // 无静态图模式下控制动画开关
        show: PropTypes.bool,
        // 图片隐藏回调
        onHide: PropTypes.func,
        // 静态图属性
        ...Image.propTypes
    }

    static defaultProps = {
        transitionDuration: 200,
        lazyLoad: true,
        thumbnail: true,
        editable: true,
        // changeStatusBarColor: false,
        initialIndex: 0,
        withoutStaticImage: true,
        show: false
    }

    constructor(props) {
        super(props);
        const { urls, initialIndex } = this.props;
        const _source = Array.isArray(urls) ? urls.map(uri => ({uri, selected: false})) : [{uri: urls, selected: false}];
        const initialImage = initialIndex + 1 <= urls.length
            ? initialIndex < 0
                ? 0
                : initialIndex
            : 0;
        this.state = {
            width: new Animated.Value(0),
            height: new Animated.Value(0),
            offsetX: new Animated.Value(SCREEN_WIDTH / 2),
            offsetY: new Animated.Value(SCREEN_HEIGHT / 2),
            opacity: new Animated.Value(0),
            imageOpacity: new Animated.Value(1),
            thumbnailTop: new Animated.Value(SCREEN_HEIGHT),
            thumbnailOpacity: new Animated.Value(0),
            isVisible: false, // 
            showStatus: false, // 是否处于大图模式，且动画已执行完毕。
            position: 'absolute', // 图片容器的position
            scrollContainerBg: 'transparent',
            initialImage,
            currentImage: initialImage,
            renderedImages: [initialImage], // 展现过的图片
            showOnlyCurrent: false,
            source: _source,
            isThumbnailVisible: false,
            editable: false, // 是否可选择缩略图
            resizeMode: 'contain',
            isGalleryAvailable: false, // 大图模式是否可用
            staticUri: {} // 静态图的uri
        };
    }

    firstMove = true;

    handle = null;

    componentDidMount() {
        const { withoutStaticImage, urls, source } = this.props;
        const { initialImage } = this.state;
        let uri = source
            ? source.uri
            : '';
        this.setStaticImageUri(uri);
        // 无静态图模式
        urls.length > 0 && withoutStaticImage && this.setState({isGalleryAvailable: true});

        this.initPanResponder();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.withoutStaticImage && prevProps.withoutStaticImage === this.props.withoutStaticImage) {
            if (!prevProps.show && this.props.show) {
                this.show();
            }
        }
        const { urls, initialIndex } = this.props;
        const _source = Array.isArray(urls) ? urls.map(uri => ({uri, selected: false})) : [{uri: urls, selected: false}];
        const initialImage = initialIndex + 1 <= urls.length
            ? initialIndex < 0
                ? 0
                : initialIndex
            : 0;
        if (this.props.initialIndex !== prevProps.initialIndex) {
            this.setState({initialImage, currentImage: initialImage, renderedImages: [initialImage]})
        }
    }

    initPanResponder = () => {
        this._panResponder = PanResponder.create({

            onStartShouldSetPanResponder: this.onStartShouldSetPanResponder,

            onStartShouldSetResponderCapture: this.onStartShouldSetResponderCapture,

            onPanResponderGrant: this.activeImageResponder,

            onPanResponderMove: this.onPanResponderMove,

            onPanResponderTerminationRequest: this.onPanResponderTerminationRequest,

            onPanResponderRelease: this.onPanResponderRelease,

            onPanResponderTerminate: this.onPanResponderRelease
            
        });

        this.activeResponder = null;

        this.viewPagerResponder = {
            onStart: (evt, gestureState) => {
                this.scrollInstance.onPanResponderGrant(evt, gestureState);
            },
            onMove: (evt, gestureState) => {
                this.scrollInstance.onPanResponderMove(evt, gestureState);
            },
            onEnd: (evt, gestureState, isFinish = true) => {
                this.scrollInstance.onPanResponderRelease(evt, gestureState, isFinish);
            }
        };

        this.imageResponder = {
            onStart: (evt, gestureState) => {
                const currentBigImage = this.getCurrentBigImageInstance();
                currentBigImage && currentBigImage.onPanResponderGrant(evt, gestureState);
            },
            onMove: (evt, gestureState) => {
                if (this.scrollInstance.scorllStatus === SCROLL_STATUS_SCROLLING) return;
                const currentBigImage = this.getCurrentBigImageInstance();
                currentBigImage && currentBigImage.onPanResponderMove(evt, gestureState);
            },
            onEnd: (evt, gestureState, normalRelease = true) => {
                const currentBigImage = this.getCurrentBigImageInstance();
                currentBigImage && currentBigImage.onPanResponderRelease(evt, gestureState, normalRelease);
            }
        };
    }

    onStartShouldSetPanResponder = () => true

    onStartShouldSetResponderCapture = () => true

    onPanResponderMove = (evt, gestureState) => {
        const { dx } = gestureState;
        // 安卓端十分敏感，设置一个有效移动距离
        if (Math.abs(dx) < MOVE_THRESHOLD && evt.touchHistory.numberActiveTouches === 1) return;
        if (this.activeResponder === this.imageResponder && this.shouldActiveViewPagerResponder(evt, gestureState)) {
                gestureState.dx = 0;
                this.activeViewPagerResponder(evt, gestureState);
        }
        if (this.activeResponder === this.viewPagerResponder) {
            const offset = this.scrollInstance.getContentOffsetFromCurrentImage();
            const { currentImage } = this.state;
            // 解决放大后头尾有残影
            if (dx >= 0 && offset >= -50 && offset < 0 && dx > offset || dx <= 0 && offset <= 50 && offset > 0 && dx < offset) {
                this.scrollInstance.updateContentOffset({offset: currentImage * SCREEN_WIDTH, isFinish: true, animated: false});
                if (!this.shouldActiveViewPagerResponder(evt, gestureState)) {
                    this.activeImageResponder(evt, gestureState);
                }
            }
        }

        this.activeResponder.onMove(evt, gestureState);
    }

    onPanResponderRelease = (evt, gestureState) => {
        this.activeResponder.onEnd(evt, gestureState);
        this.firstMove = true;
    }

    onPanResponderTerminationRequest = (evt, gestureState) => false


    activeImageResponder = (evt, gestureState) => {
        if (this.activeResponder !== this.imageResponder) {
            if (this.activeResponder === this.viewPagerResponder) {
                this.viewPagerResponder.onEnd(evt, gestureState, false); // pass true to disable ViewPager settle
            }
            this.activeResponder = this.imageResponder;
        }
        this.imageResponder.onStart(evt, gestureState);
    }
    
    activeViewPagerResponder = (evt, gestureState) => {
        if (this.activeResponder !== this.viewPagerResponder) {
            if (this.activeResponder === this.imageResponder) {
                this.imageResponder.onEnd(evt, gestureState, false);
            }
            this.activeResponder = this.viewPagerResponder;
            this.viewPagerResponder.onStart(evt, gestureState);
        }
    }

    shouldActiveViewPagerResponder = (evt, gestureState) => {
        const currentBigImage = this.getCurrentBigImageInstance();
        const { currentImage, source } = this.state;
        if (gestureState.numberActiveTouches > 1 || !currentBigImage) return false;
        const range = currentBigImage.getHorizontalRange();
        if (gestureState.dx > 0 && range.left <= 0 && currentImage > 0) {
            return true;
        }
        if (gestureState.dx < 0 && range.right <= 0 && currentImage < source.length - 1) {
            return true;
        }
        return false;
    }

    getCurrentBigImageInstance = () => {
        const { currentImage } = this.state;
        return this.imageRefs.get(currentImage);
    }

    createAnimation = () => {
        this.handle = InteractionManager.createInteractionHandle();
    }

    clearAnimation = () => {
        if (this.handle) {
            InteractionManager.clearInteractionHandle(this.handle);
            this.handle = null;
        }
    }

    /**
     * 重置组件状态
     */

    resetState = () => {
        const { initialImage } = this.state;
        const { urls: source, initialPage } = this.props;
        const _source = Array.isArray(source) ? source.map(uri => ({uri, selected: false})) : [{uri: source, selected: false}];
        this.setState(prev => ({
            renderedImages: [initialImage],
            currentImage: initialImage,
            source: _source,
            imageOpacity: new Animated.Value(1),
            position: 'absolute',
            showStatus: false,
            resizeMode: 'contain'
        }));
    }

    show = async () => {
        if (this.state.isGalleryAvailable) {
            await this.getPosition();
            this.setState({isVisible: true});
            this.showImage();
        }
    }

    hide = () => {
        this.setState({isVisible: false});
    }

    /**
     * 进场的一系列动画，包括：
     * 宽、高、容器背景色透明度、位置信息x，y、图片透明度
     */

    showImage = () => {
        this.setState({resizeMode: 'contain'});
        const width = SCREEN_WIDTH;
        const height = SCREEN_HEIGHT;
        const { transitionDuration } = this.props;
        const _transitionDuration = Platform.select({ios: transitionDuration, android: 0});
        this.state.opacity.setValue(0.5);
        Animated.parallel([
            Animated.timing(this.state.width, {
                toValue: width,
                duration: _transitionDuration,
                easing: Easing.bezier(.19, .88, .72, 1)
            }),
            Animated.timing(this.state.height, {
                toValue: height,
                duration: _transitionDuration,
                easing: Easing.bezier(.19, .88, .72, 1)
            }),
            Animated.timing(this.state.opacity, {
                toValue: 1,
                duration: _transitionDuration,
                easing: Easing.bezier(.19, .88, .72, 1)
            }),
            // Animated.timing(this.state.imageOpacity, {
            //     toValue: 1,
            //     duration: _transitionDuration,
            //     easing: Easing.bezier(0,.34,.59,.97)
            // }),
            Animated.timing(this.state.offsetX, {
                toValue: 0,
                duration: _transitionDuration,
                easing: Easing.bezier(.19, .88, .72, 1)
            }),
            Animated.timing(this.state.offsetY, {
                toValue: 0,
                duration: _transitionDuration,
                easing: Easing.bezier(.19, .88, .72, 1)
            })
        ]).start(this.afterShowImage);
    }

    /**
     * 进场动画完毕
     * 设置position为relative防止图片错位，滚动容器背景设为黑
     */

    afterShowImage = () => {
        this.setState(prev => ({
            showStatus: true,
            position: 'relative',
            scrollContainerBg: 'black',
            resizeMode: 'center'
        }), () => this.setState({resizeMode: 'contain'}));
    }

    /**
     * 出场的一系列动画。
     * 动画分为回到原位置和消失在中点。
     */

    hideImage = () => {
        const index = this.state.currentImage;
        const { initialImage } = this.state;
        const { transitionDuration, withoutStaticImage } = this.props;
        if (this.state.showStatus) {
            let widthValue, heightValue, offsetXValue, offsetYValue;
            //     
            if (index === initialImage && this.props.smallImage || this.smallImage) {
                widthValue = this.initialWidth;
                heightValue = this.initialHeight;
                offsetXValue = this.initialOffsetX;
                // offsetYValue = Platform.select({ios: this.initialOffsetY, android: this.initialOffsetY - (SCREEN_HEIGHT - this.initialHeight) / 2});
                offsetYValue = Platform.select({android: this.initialOffsetY - StatusBar.currentHeight, ios: this.initialOffsetY});
            } else {
                widthValue = 0;
                heightValue = 0;
                // offsetXValue = (SCREEN_WIDTH + this.initialWidth) / 2;
                offsetXValue = SCREEN_WIDTH / 2; // for ios
                // offsetYValue = Platform.select({ios: (SCREEN_HEIGHT - this.initialHeight) / 2, android: 0});
                offsetYValue = (SCREEN_HEIGHT - this.initialHeight) / 2;
            }

            //
            this.setState(prev => ({
                showStatus: false,
                position: 'relative',
                scrollContainerBg: 'transparent',
                source: [prev.source[index]] // 清空其他图片是为了防止动画过程中出现干扰。
            }), () => {
                this.scrollInstance.updateContentOffset({offset: 0, animated: false});
                Animated.parallel([
                    Animated.timing(this.state.width, {
                        toValue: widthValue,
                        duration: transitionDuration,
                        easing: Easing.bezier(0,.34,.59,.97)
                    }),
                    Animated.timing(this.state.height, {
                        toValue: heightValue,
                        duration: transitionDuration,
                        easing: Easing.bezier(0,.34,.59,.97)
                    }),
                    // Animated.timing(this.state.imageOpacity, {
                    //     toValue: 0,
                    //     duration: transitionDuration,
                    //     easing: Easing.bezier(0,.34,.59,.97)
                    // }),
                    Animated.timing(this.state.opacity, {
                        toValue: 0,
                        duration: transitionDuration,
                        easing: Easing.bezier(0,.34,.59,.97)
                    }),
                    Animated.timing(this.state.offsetX, {
                        toValue: offsetXValue,
                        duration: transitionDuration,
                        easing: Easing.bezier(0,.34,.59,.97)
                    }),
                    Animated.timing(this.state.offsetY, {
                        toValue: offsetYValue,
                        duration: transitionDuration,
                        easing: Easing.bezier(0,.34,.59,.97)
                    })
                ]).start(this.afterHideImage);
                
            });
        }
    }

    afterHideImage = () => {
        const { onHide } = this.props;
        this.hide();
        this.resetState();
        onHide && onHide();
    }

    /**
     * 获取静态图的大小
     */

    onImageLayout = ({nativeEvent: {layout: {width, height}}}) => {
        this.setState({width: new Animated.Value(width), height: new Animated.Value(height)});
        this.initialWidth = width;
        this.initialHeight = height;
    }

    /**
     * 获取静态图的位置信息
     */

    getPosition(offsetY) {
        return new Promise((resolve, reject) => {
            const smallImageInstance = this.props.withoutStaticImage
                ? this.props.smallImage
                : this.smallImage;

            if (smallImageInstance) {
                smallImageInstance.measure((fx, fy, width, height, px, py) => {
                    this.initialWidth = width;
                    this.initialHeight = height;
                    this.initialOffsetX = px;
                    this.initialOffsetY = py;
                    this.setState(
                        {
                            offsetX: new Animated.Value(px),
                            offsetY: new Animated.Value(py),
                            width: new Animated.Value(width),
                            height: new Animated.Value(height)
                        },
                        resolve()
                    );
                });
            } else {
                this.initialWidth = 0;
                this.initialHeight = 0;
                resolve();
            }
        });
    }

    /**
     * 设置静态图uri地址
     */

    setStaticImageUri = (uri) => {
        if (typeof uri === 'string' && uri !== '') {
            this.setState({staticUri: Object.assign({}, {uri}, {cache: 'force-cache'})});
        } else {
            this.resetStaticImageUri();
        }
    }

    /**
     * 设置静态图为默认图片
     */

    resetStaticImageUri = () => {
        this.setState({staticUri: this.props.defaultSource});
    }

    onStaticImageLoad = () => {
        const { staticUri } = this.state;
        const { defaultSource } = this.props;
        if (staticUri !== defaultSource) {
            this.setState({isGalleryAvailable: true});
        }
    }

    onScrollEnd = ({nativeEvent}) => {
        const currentImage = nativeEvent.contentOffset
            ? Math.floor(Math.round(nativeEvent.contentOffset.x / SCREEN_WIDTH, 4))
            : nativeEvent.position;
        this.setState({currentImage});

        const { renderedImages } = this.state;
        if (!renderedImages.includes(currentImage)) {
            this.setState({renderedImages: [currentImage, ...renderedImages]});
        }
        this.clearAnimation();
    }

    showThumbnail = () => {
        if (!this.isThumbnailVisible) {
            this.isThumbnailVisible = true;
            this.state.thumbnailTop.setValue(90);
            this.state.thumbnailOpacity.setValue(0.1);
            Animated.parallel([
                Animated.timing(this.state.thumbnailTop, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.bezier(.19,.4,.99,.64)
                }),
                Animated.timing(this.state.thumbnailOpacity, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.bezier(.19,.4,.99,.64)
                })
            ]).start();
        }
    }

    hideThumbnail = () => {
        if (this.isThumbnailVisible) {
            Animated.parallel([
                Animated.timing(this.state.thumbnailTop, {
                    toValue: 120,
                    duration: 200,
                    easing: Easing.bezier(.19,.4,.99,.64)
                }),
                Animated.timing(this.state.thumbnailOpacity, {
                    toValue: 0.2,
                    duration: 200,
                    easing: Easing.bezier(.19,.4,.99,.64)
                }),
            ]).start(() => {
                this.isThumbnailVisible = false;
                this.state.thumbnailTop.setValue(SCREEN_HEIGHT);
                this.state.thumbnailOpacity.setValue(0);
            });
        }
    }

    /**
     * scrollview跳转到指定图片/位置
     * @param {number} index 从0开始的位置信息
     */
    updateScrollView = (index) => {
        const x = index * SCREEN_WIDTH;
        this.scrollInstance.scrollView.scrollToOffset({offset: x, animated: false});
        this.onScrollEnd({nativeEvent: {position: index}});
    }

    onThumbnailImageClick = (index) => {
        this.hideThumbnail();
        this.updateScrollView(index);
    }

    toggleImageSelectState = (targetIndex) => {
        // const { source } = this.state
        const _source = this.state.source.map((sourceImage, index) => {
            if (index === targetIndex) {
                sourceImage.selected = !sourceImage.selected;
            }
            return sourceImage;
        });
        this.setState({source: _source});
    }

    // 退出编辑状态
    cancelEditState = () => {
        this.setState({editable: false});
    }

    // 切换并重置编辑状态
    toggleEditState = () => {
        const { urls: source } = this.props;
        const _source = Array.isArray(source) ? source.map(uri => ({uri, selected: false})) : [{uri: source, selected: false}];
        this.setState((prev) => ({editable: !prev.editable, source: _source}));
    }

    onShareBtnClick = () => {
        // ActionSheet.showActionSheetWithOptions({
        //     options:['分享选中图片','分享全部图片', '取消'],
        //     cancelButtonIndex: 2,
        //     maskClosable: true,
        // }, value => {
        //     if(value === 0){
        //         this.shareSelectedImages();
        //     } else if(value === 1) {
        //         this.shareAllImages();
        //     }
        // });
    }

    shareSelectedImages = () => {
        const urls = [];
        this.state.source.forEach(image => {
            if (image.selected) {
                urls.push(image.uri);
            }
        });

        // if (urls.length > 0) {
        //     DLShareModule.shareImageURLs(urls, () => {});
        // } else {
        //     Alert.alert('未选择任何图片，请检查后再试');
        // }
    }

    shareAllImages = () => {
        const { urls } = this.props;
        const _source = Array.isArray(urls) ? urls.map(uri => ({uri, selected: false})) : [{uri: urls, selected: false}];
        // DLShareModule.shareImageURLs(_source, () => {});
    }

    /**
     * 渲染静态静态图
     * android下defaultSource实现有问题，用source代替
     */

    renderStaticImage = () => {
        const { withoutStaticImage, style, defaultSource, lazyLoad, urls, thumbnail, initialIndex, transitionDuration, editable, source, ...imageProps } = this.props;
        const { staticUri } = this.state;
        if (withoutStaticImage) {
            return null;
        }

        return (
            <TouchableWithoutFeedback onPress={this.show} onLayout={this.onImageLayout}>
                <Image
                    onLoad={this.onStaticImageLoad}
                    // onError={this.resetStaticImageUri}
                    ref={view => this.smallImage = view}
                    defaultSource={this.props.defaultSource}
                    source={staticUri}
                    style={[{resizeMode: 'cover'}, style]}
                    {...imageProps}
                />
            </TouchableWithoutFeedback>
        );
    }

    imageRefs = new Map();

    /**
     * 渲染gallery图片
     */

    renderImage = ({item: sourceImage, index}) => {
        const {
            position,
            width,
            height,
            offsetX,
            offsetY,
            opacity,
            renderedImages,
            showStatus,
            initialImage,
            currentImage,
            source,
            resizeMode,
            imageOpacity
        } = this.state;
        const { lazyLoad } = this.props;
        const targetUri = lazyLoad
            ? renderedImages.includes(index)
                ? sourceImage.uri
                : 'data:'
            : sourceImage.uri;

        if (showStatus || index === initialImage || source.length === 1) {
            return (
                <BigImage
                    resizeMode={resizeMode}
                    position={position}
                    width={width}
                    height={height}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    opacity={opacity}
                    imageOpacity={imageOpacity}
                    showStatus={showStatus}
                    onPress={this.hideImage}
                    targetUri={targetUri}
                    createAnimation={this.createAnimation}
                    clearAnimation={this.clearAnimation}
                    ref={view => {this.imageRefs.set(index, view);}}
                />
            )
        } else {
            return (
                <View style={{width: SCREEN_WIDTH, height: SCREEN_HEIGHT}}/>
            )
        }
        // return (showStatus || index === initialImage || source.length === 1) && (
        //     <BigImage
        //         resizeMode={resizeMode}
        //         position={position}
        //         width={width}
        //         height={height}
        //         offsetX={offsetX}
        //         offsetY={offsetY}
        //         opacity={opacity}
        //         imageOpacity={imageOpacity}
        //         showStatus={showStatus}
        //         onPress={this.hideImage}
        //         targetUri={targetUri}
        //         createAnimation={this.createAnimation}
        //         clearAnimation={this.clearAnimation}
        //         ref={view => {this.imageRefs.set(index, view);}}
        //     />
        // );
    }

    /**
     * gallery滑动容器
     */
    
    renderScrollView = () => {
       
        const { currentImage, source, opacity, scrollContainerBg, showStatus, initialImage } = this.state;
        const panHandlers = showStatus ? this._panResponder.panHandlers : {};
        // const contentOffset = this.getInitialOffset();

        return (
            <View
                style={{width: SCREEN_WIDTH, height: SCREEN_HEIGHT}}
                {...this._panResponder.panHandlers}
            >
                <ViewPager
                    showStatus={showStatus}
                    currentImage={currentImage}
                    source={source}
                    initialIndex={initialImage}
                    opacity={opacity}
                    ref={view => this.scrollInstance = view}
                    scrollContainerBg={scrollContainerBg}
                    renderItem={this.renderImage}
                    onScrollEnd={this.onScrollEnd}
                    imageRefs={this.imageRefs}
                >
                    {showStatus && this.renderIndicator()}
                    {showStatus && this.renderGirdButton()}
                    {/* 设置一层View，用以接收ViewPager相关panHandler */}
                    {showStatus && <View style={{width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute', zIndex: 20, top: 0, left: 0, opacity: 0, backgroundColor: 'transparent'}}/>}
                </ViewPager>
            </View>
        );
    }


    renderIndicator = () => {
        const { currentImage, source } = this.state;
        return (
            <View style={styles.indicatorContainer}>
                <Text style={styles.indicator}>{`${currentImage + 1} / ${source.length}`}</Text>
            </View>
        );
    }

    renderThumbnailHeader = () => {
        const headerRightText = this.state.editable
            ? '取消选择'
            : '选择图片';
        return (
            <View style={[styles.thumbnailHeader, { justifyContent: 'space-between', marginTop: Platform.select({ios: STATUS_BAR_HEIGHT, android: 0})}]}>
                <TouchableOpacity style={styles.backButton}
                    onPress={this.hideThumbnail}
                >
                    <Image
                        source={require('../static/back.png')}
                        style={styles.backIcon}
                    />
                    <Text style={{color: '#fff', fontSize: 18}}>图片</Text>
                </TouchableOpacity>
                {this.props.editable &&
                    <TouchableOpacity
                        style={{padding: 8}}
                        onPress={this.toggleEditState}
                    >
                        <Text style={{color: '#fff', fontSize: 18}}>{headerRightText}</Text>
                    </TouchableOpacity>}
            </View>
        );
    }

    renderThumbnailImage = (sourceImage, index) => {
        const hasMarginRight = (index + 1) % 4 !== 0;
        const selectedIcon = sourceImage.selected
            ? require('../static/selected.png')
            : require('../static/unselected.png');
        return (
            <TouchableWithoutFeedback
                key={sourceImage.uri}
                onPress={() => this.onThumbnailImageClick(index)}
            >
                <View style={{height: SCREEN_WIDTH * 0.244}}>
                    <Image
                        source={{uri: sourceImage.uri, cache: 'force-cache'}}
                        resizeMode='cover'
                        style={{backgroundColor: '#fff', width: SCREEN_WIDTH * 0.244, height: SCREEN_WIDTH * 0.244, marginRight: hasMarginRight ? SCREEN_WIDTH * 0.008 : 0, marginBottom: SCREEN_WIDTH * 0.008}}
                    />
                    {this.state.editable &&
                        <TouchableOpacity
                            style={{position: 'absolute', top: 5, right: 5, padding: 5}}
                            onPress={() => this.toggleImageSelectState(index)}
                        >
                            <Image
                                source={selectedIcon}
                                style={{width: 20, height: 20}}
                            />
                        </TouchableOpacity>}
                </View>
            </TouchableWithoutFeedback>
        );
    }

    renderGirdButton = () => {
        return this.props.thumbnail
            ? (
                <TouchableOpacity
                    style={styles.girdBtnContainer}
                    onPress={this.showThumbnail}
                >
                    <Image
                        style={{width: 20, height: 20, resizeMode: 'contain'}}
                        source={require('../static/grid-button.png')}
                    />
                </TouchableOpacity>
            )
            : null;
    }

    renderShareButton = () => {
        return this.props.editable
            ? (
                <TouchableOpacity
                    style={styles.shareBtnContainer}
                    onPress={this.onShareBtnClick}
                >
                    <Image
                        style={{width: 20, height: 20, resizeMode: 'contain'}}
                        source={require('../static/share-button.png')}
                    />
                </TouchableOpacity>
            )
            : null;
    }

    renderThumbnailView = () => {
        return this.props.thumbnail
            ? (
                <Animated.View
                    style={[{zIndex: 100, position: 'absolute', width: SCREEN_WIDTH, height: SCREEN_HEIGHT, opacity: this.state.thumbnailOpacity}, {top: this.state.thumbnailTop}]}
                >
                    <SafeAreaView style={{backgroundColor: '#333', flex: 1}}>
                        {this.renderThumbnailHeader()}
                        <View style={{flex: 1}}>
                            <ScrollView style={{backgroundColor: '#000'}}>
                                <View style={styles.thumbnailContainer}>
                                    {this.state.source.map((sourceImage, index) => this.renderThumbnailImage(sourceImage, index))}
                                </View>
                            </ScrollView>
                            {this.renderShareButton()}
                        </View>
                    </SafeAreaView>
                </Animated.View>
            )
            : null;
    }

    renderModal = () => {
        return (
            <Modal isVisible={this.state.isVisible} transparent={true}>
                {this.renderScrollView()}
                {this.renderThumbnailView()}
            </Modal>
        );
    }

    render() {
        return (
            <View style={{zIndex: 99}}>
                {this.renderStaticImage()}
                {this.state.isVisible && this.renderModal()}
            </View>
        );
    }
}

const styles = StyleSheet.create({
  thumbnailHeader: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    backgroundColor: '#333'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  backIcon: {
    width: 12,
    height: 20,
    marginRight: 10
  },
  thumbnailContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'black'
  },
  shareBtnContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, .2)',
    bottom: 24,
    right: 15,
    padding: 5
  },
  girdBtnContainer: {
    position: 'absolute',
    top: Platform.select({ios: 50 - STATUS_BAR_HEIGHT, android: 10}),
    right: 15,
    padding: 10,
    zIndex: 50
  },
  indicatorContainer: {
    position: 'absolute',
    top: Platform.select({ios: 50 - STATUS_BAR_HEIGHT, android: 10}),
    alignSelf: 'center',
    paddingTop: 10
  },
  indicator: {
    color: 'white',
    fontSize: 20
  }
});