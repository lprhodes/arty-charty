import React, {Component} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  ART,
  TouchableOpacity
} from 'react-native';
const {Surface, Group, Shape, LinearGradient} = ART;
import {complement, Tweener, AmimatedCirclesMarker, makeBars3DChartPath, makeBarsChartPath, makeAreaChartPath, makeLineChartPath, makeSplineChartPath, makeCandlestickChartPath, makeCandlestickChart, inerpolateColorsFixedAlpha, makeSpline, computeSplineControlPoints, makeCircle, getMinMaxValues, getMinMaxValuesCandlestick, getMinMaxValuesRange, getMaxSumStack, getMaxSumBars3d, findRectangleIndexContainingPoint, findClosestPointIndexWithinRadius, makeAreaRangeChartPath, makeLineStepChartPath, makeStackedBarsChartPath} from '.';
import {Spring,Bounce,EasingFunctions} from '../timing-functions';

const SELCTED_MARKER_ANIMATION_DURATION = 1000;
const SELCTED_MARKER_ANIMATION_DELAY_1 = SELCTED_MARKER_ANIMATION_DURATION * .2;
const SELCTED_MARKER_ANIMATION_DELAY_2 = SELCTED_MARKER_ANIMATION_DURATION * .3;
const UNSELCTED_MARKER_ANIMATION_DURATION = 500;
const UNSELCTED_MARKER_ANIMATION_DELAY_1 = UNSELCTED_MARKER_ANIMATION_DURATION * .2;
const UNSELCTED_MARKER_ANIMATION_DELAY_2 = UNSELCTED_MARKER_ANIMATION_DURATION * .3;
const MARKER_RADIUS = 8;
const MARKER_RADIUS_2 = MARKER_RADIUS * .75;
const MARKER_RADIUS_3 = MARKER_RADIUS * .5;
const MARKER_RADIUS_SQUARED = Math.pow(MARKER_RADIUS, 3);

const PAD_LEFT = 0;

const SHOW_CLICKS = false;

const CHART_GROW_ANIMATION_DURATION = 2000;
const CLICK_FEDDBACK_ANIMATION_DURATION = 500;

const CHART_HEIGHT = 125;
const CHART_HEIGHT_OFFSET = CHART_HEIGHT / 2;

const DEFAULT_LINE_COLOR = 'rgba(255,255,255,.5)';

class ArtyCharty extends Component {
  constructor(props) {
    super(props);
    this.resetState(props.activeMarker || {});
  }

  resetState (activeMarker = {}) {
    this.state = {
      trX: 0,
      t: this.props.animated ? 0 : 1,
      gradientStops: {},
      activeMarker,
      clickFeedback: {
        x: 0,
        y: 0,
        o: 0,
        r: 0
      }
    };
    this.maxScroll = 0;
    this.stopAnimateClickFeedback = false;
  }

  init() {
    // Compute constants for all charts, such as maxValues:
    this.computeChartConstants();
    if (this.props.yAxisLeft) {
      //this.yAxis = this.makeYaxis(this.props.yAxisLeft.numberOfTicks > 1 ? this.props.yAxisLeft.numberOfTicks-1 : this.props.yAxisLeft.numberOfTicks, this.minValue, this.maxValue);
      this.yAxis = this.makeYaxis(this.props.yAxisLeft.numberOfTicks > 1 ? this.props.yAxisLeft.numberOfTicks-1 : this.props.yAxisLeft.numberOfTicks, 0, this.maxValue);
    }
    if (this.props.animated) {
      this.initChartGrowAnimations();
    }

    // Only call if this.props.interactive
    if (this.props.interactive) {
      this.initPanHandler();
    } else {
      this._panResponder = {};
    }

    if (this.props.clickFeedback) {
      this.animateClickFeedbackTweener = new Tweener(CLICK_FEDDBACK_ANIMATION_DURATION, t => {
            this.setState(Object.assign(this.state,
                Object.assign(this.state.clickFeedback, {
                  o: 1 - t,
                  r: 100 * t
                })
          ));
      }, EasingFunctions.easeOutCubic, false);
    }

    // Only call if lowHighCol stuff?????
    this.makeChartFillColors();
  }

  componentWillMount() {
    this.init();
  }

  componentDidMount() {
    if (this.props.animated) {
      this.animateChart();
    }
  }

  computeChartConstants() {
    let maxDataPoints = 0;
    this.maxValue = Number.MIN_VALUE;
    this.minValue = Number.MAX_VALUE;
    this.props.data.forEach(d => {
      let val;
      if (d.type === 'candlestick') {
        val = getMinMaxValuesCandlestick(d.data)
      } else if (d.type === 'area-range') {
        val = getMinMaxValuesRange(d.data);
      } else if (d.type === 'stacked-bars') {
        val = {maxValue: getMaxSumStack(d.data)};
      } else if (d.type === 'bars-3d') {
        val = {maxValue: getMaxSumBars3d(d.data)};
      } else {
        val = getMinMaxValues(d.data);
      }
      d.maxValue = val.maxValue;
      d.minValue = val.minValue;
      this.maxValue = Math.max(this.maxValue, val.maxValue);
      this.minValue = Math.min(this.minValue, val.minValue);
      maxDataPoints = Math.max(maxDataPoints, d.data.length);
    });
    // If points on screen parameter is not provided, find chart
    // with most datapoints and use that instead:
    this.pointsOnScreen = this.props.pointsOnScreen ? this.props.pointsOnScreen : maxDataPoints;
  }

  initChartGrowAnimations() {
    this.animateChartSpring = new Spring({friction: 150, frequency: 500});
    this.animateChartSpring2 = new Spring({friction: 150, frequency: 550, anticipationSize: 50});
    this.animateChartTweener = new Tweener(CHART_GROW_ANIMATION_DURATION, t => {
          this.setState(Object.assign(this.state, {t}));
    }, EasingFunctions.linear, false);

    let ts = [];
    this.props.data.forEach(d => {
      if (d.timingFunctions) {
        return;
      }
      // Depending on type and props, select approtaley here...
      let timeingFunction;
      switch (d.chartGrowAnimation) {
        case 'linear':
        case 'easeInQuad':
        case 'easeOutQuad':
        case 'easeInOutQuad':
        case 'easeInCubic':
        case 'easeOutCubic':
        case 'easeInOutCubic':
        case 'easeInQuart':
        case 'easeOutQuart':
        case 'easeInOutQuart':
        case 'easeInQuint':
        case 'easeOutQuint':
        case 'easeInOutQuint':
        case 'bounce':
          d.timingFunctions = [
            (t) => {
            return EasingFunctions[d.chartGrowAnimation](t);
            }
          ];
          break;
        case 'spring':
        default:
          d.timingFunctions = [
            (t) => {
            return this.animateChartSpring.interpolate(t);
            },
            (t) => {
            return this.animateChartSpring2.interpolate(t);
            }
          ];
      }
      });
  }

  /**
   * Initialise the pan handler used for horizontal scrolling
   * and click handling.
   */
  initPanHandler() {
    let sX;
    let moved = false;
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      onPanResponderGrant: this.props.noScroll ? ()=>{} : (evt, gestureState) => {
        sX = this.state.trX;
        moved = false;
      },
      onPanResponderMove: this.props.noScroll ? ()=>{} : (evt, gestureState) => {
        // this.setState(Object.assign(this.state, {
        //   trX: Math.min(20, Math.max(sX + gestureState.dx, -this.maxScroll - 20))
        // }));
        moved = true;
      },
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        let tmpX = gestureState.x0;
        let tmpY = gestureState.y0;
        // if (!moved) {
          this
            .refs
            .chart
            .measure((fx, fy, width, height, px, py) => {
              if (this.props.clickFeedback) {
                this.animateClickFeedback(tmpX - px, tmpY - py + CHART_HEIGHT / 2);
              }
              this.props.data.some((d, idx) => {
                if (d.type.slice(0,4) === 'area' || d.type === 'line' || d.type.substr(0, 6) === 'spline') {
                  let closestMarker = findClosestPointIndexWithinRadius(d.markerCords, tmpX - px, tmpY - py + CHART_HEIGHT / 2, MARKER_RADIUS_SQUARED);
                  if (closestMarker !== undefined) {
                    this.onMarkerClick(idx, closestMarker);
                    return true;
                  }
                } else if (d.type.slice(0,4) === 'bars') {
                  let clickedBar = findRectangleIndexContainingPoint(d.barCords, tmpX - px, tmpY - py + CHART_HEIGHT / 2);
                  if (clickedBar !== undefined) {
                    this.onMarkerClick(idx, clickedBar);
                    // Only return true if this is the last chart, there might be line charts infront..
                    if (idx === this.props.data.length-1) {
                      return true;
                    }
                  }
                } else if (d.type === 'candlestick' || d.type === 'stacked-bars') {
                  let clickedCandlestick = findRectangleIndexContainingPoint(d.barCords, tmpX - px, tmpY - py + CHART_HEIGHT / 2);
                  if (clickedCandlestick !== undefined) {
                    this.onMarkerClick(idx, clickedCandlestick);
                    // Only return true if this is the last chart, there might be line charts infront..
                    if (idx === this.props.data.length-1) {
                      return true;
                    }
                  }
                }
              });
            });
        // }
      },
      onPanResponderTerminate: (evt, gestureState) => {},
      onShouldBlockNativeResponder: (evt, gestureState) => {
        return true;
      }
    });
  }

componentWillReceiveProps(nextProps) {
  if (this.props.data !== nextProps.data || this.props.pointsOnScreen !== nextProps.pointsOnScreen) {
    this.props = nextProps;
    this.resetState(nextProps.activeMarker);
    this.init();
    // Uncoment if statement to only restart animation
    // if it isn't already playing when switching charts
    // if (!this.animateChartTweener.isPlaying()) {
      if (this.props.animated) {
        this.animateChart();
      }
    // }
  }
}

  componentWillUnmount() {
    if (this.animateClickFeedbackTweener) this.animateClickFeedbackTweener.stop();
    if (this.animateChartTweener) this.animateChartTweener.stop();
  }

  onMarkerClick(chartIdx, pointIdx) {
    if (chartIdx !== this.state.activeMarker.chartIdx || pointIdx !== this.state.activeMarker.pointIdx) {
        this.setState(Object.assign(this.state, {activeMarker: {chartIdx, pointIdx}}));
        if (this.props.onMarkerClick) {
          this.props.onMarkerClick(chartIdx, pointIdx);
        }
    }
  }

  makeChartFillColors() {
    this.props.data.forEach(chart => {
      if (chart.type === 'bars' || chart.type.slice(-4) === 'area' || chart.type.slice(0,4) === 'area') {
        chart.data.forEach(d => {
           d.fillColors = {
            active: inerpolateColorsFixedAlpha(chart.highCol || chart.lineColor || 'white',
                                                  chart.lowCol || chart.lineColor || 'white',
                                                  d.value/this.maxValue, 1),
            inactive: inerpolateColorsFixedAlpha(chart.highCol || chart.lineColor || 'white',
                                                  chart.lowCol || chart.lineColor || 'white',
                                                  d.value/this.maxValue, .5)
          };
        });
      }
    });
  }

  makeGradStops(maxValue, chartIdx) {
    let gradStops = {};
    this.props
      .data[chartIdx].data
      .forEach((d, idx) => {
        let fillColors = d.fillColors ? d.fillColors : {active: 'white', inactive: 'gray'};
        let color = fillColors.inactive;
        gradStops[(idx / this.props.data[chartIdx].data.length) + (.5 / this.props.data[chartIdx].data.length)] = color;
      });
      return gradStops;
  }

makeMarkersCoords(chart, width, t) {
  let markerCords = [];
  let xCord;
  let yCord;
  const difference = (this.maxValue - this.minValue)
  let heightScaler = (CHART_HEIGHT-((MARKER_RADIUS * 0.75) * 2))/ (difference + (difference / 5));
  let xSpacing = (width - ((MARKER_RADIUS * 0.75) * 2)) / (this.pointsOnScreen - 1);
  let fullWidth = width

  chart.data.forEach((d,idx) => {
    let spacing = idx*xSpacing;
    if (spacing > fullWidth * t && chart.drawChart) {
          return true;
        }
    if (chart.stretchChart) {
      xCord = t * (spacing + MARKER_RADIUS);
    } else {
      Math.floor(xCord = spacing + (MARKER_RADIUS * 0.75));
    }
    yCord = (CHART_HEIGHT+CHART_HEIGHT_OFFSET) - ((d.value - (this.minValue - (difference / 10))) * heightScaler)
    markerCords.push({x: xCord, y: yCord});
  });
  return markerCords;
}

makeMarkers(markerCords, chartIdx) {
  return markerCords.map((d, idx) => {
    return this.makeMarker(d.x, d.y, chartIdx, idx);
  });
}

makeMarker(cx, cy, chartIdx, pointIdx) {
    return (
      <AmimatedCirclesMarker key={pointIdx} cx={cx} cy={cy} baseColor={this.props.data[chartIdx].lineColor || 'rgba(0,0,0,.5)'}
       active={this.state.activeMarker.chartIdx === chartIdx && this.state.activeMarker.pointIdx === pointIdx} />
    );
  }

makeYaxis(num, minVal, maxVal) {
  let topY = (CHART_HEIGHT+CHART_HEIGHT_OFFSET) - this.maxValue * ((CHART_HEIGHT-MARKER_RADIUS)/this.maxValue) - MARKER_RADIUS - 2;
  let bottomY = CHART_HEIGHT+CHART_HEIGHT/2 - MARKER_RADIUS - 2;
  let i;
  let interval = (bottomY - topY) / num;
  let lineVal = this.maxValue;
  let lineDecrement = (maxVal - minVal) / num;
  let lines = [];
  for (i = 1 ; i <= num; i++) {
    lines.push(<Shape key={i} stroke={GlobalStyles.separatorColor} strokeWidth={GlobalStyles.borderWidth}  d={`M ${MARKER_RADIUS / 2} ${Math.floor(topY + interval * i)} H ${(this.props.width || Dimensions.get('window').width) - (MARKER_RADIUS / 2)}`} />);
    // lines.push(<ART.Text key={1000+i} fill="black" x={0} y={(topY + interval * i) - 22} font="12px Ubuntu">{lineVal.toFixed(2)}</ART.Text>);
    lineVal -= lineDecrement;
  }

  lines.push(<Shape key={num + 1} stroke={GlobalStyles.separatorColor} strokeWidth={GlobalStyles.borderWidth}  d={`M ${Math.floor(MARKER_RADIUS / 2)} ${topY + (MARKER_RADIUS / 2)} V ${(CHART_HEIGHT * 2) - MARKER_RADIUS - (MARKER_RADIUS / 2)}`} />);

  return lines;
}

animateChart(endTime) {
  this.animateChartTweener.resetAndPlay();
}

animateClickFeedback(x, y) {
  this.animateClickFeedbackTweener.stop();
  this.setState(Object.assign(this.state, {
      clickFeedback: {
        x: x,
        y: y,
        o: 0,
        r: 0
      }
  }));
  this.animateClickFeedbackTweener.resetAndPlay();
}

makeLinearGradientForAreaChart(chart, idx, width) {
  return new LinearGradient(this.makeGradStops(chart.maxValue, idx), 0, 0, width, 0);
}

  render() {
    let width = this.props.width || Dimensions.get('window').width;
     let charts = this.props.data.map((chart, idx) =>  {
       let chartData;
       let charts = [];
       let markerCords;
       let makeMarkers = true;
       let doBreak = false;
       let rangeChart = false;
       switch (chart.type) {
         case 'area':
            chartData = makeAreaChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen);
            // Max assumes chart doesn't shrink subsequently. If that is the case,weneed to
            // recomputmax for all!!
            this.maxScroll = Math.max(this.maxScroll, chartData.maxScroll || 0);
            // this.maxScroll = chartData.maxScroll;
            charts.push(<Shape key={idx} d={chartData.path}
              fill={this.makeLinearGradientForAreaChart(chart, idx, chartData.width)}
            />);
            if (chart.hideLine) {
              break;
            }
            doBreak = true;
          case 'area-range':
            if (!doBreak) {
              chartData = makeAreaRangeChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen);
            this.maxScroll = Math.max(this.maxScroll, chartData.maxScroll || 0);
            charts.push(<Shape key={idx} d={chartData.path}
              fill={this.makeLinearGradientForAreaChart(chart, idx, chartData.width)}
            />);
            if (chart.hideLine) {
              break;
            }
            }
          case 'line':
            chartData = makeLineChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen);
            this.maxScroll = Math.max(this.maxScroll, chartData.maxScroll || 0);
            charts.push(<Shape
                  key={idx + 10000}
                  d={chartData.path}
                  stroke={chart.lineColor || DEFAULT_LINE_COLOR}
                  strokeWidth={2} />);
            // Make marker coords:
            markerCords = this.makeMarkersCoords(chart, width, this.state.t);
            chart.markerCords = markerCords;
            charts.push(this.makeMarkers(markerCords, idx));
            break;
          case 'step':
            chartData = makeLineStepChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen);
            this.maxScroll = Math.max(this.maxScroll, chartData.maxScroll || 0);
            charts.push(<Shape
                  key={idx + 10000}
                  d={chartData.path}
                  stroke={chart.lineColor || DEFAULT_LINE_COLOR}
                  strokeWidth={3} />);
            break;
          case 'spline-area':
            chartData = makeSplineChartPath(chart, width, this.state.t, this.minValue, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, true);

              const fill = Platform.OS === 'ios' ? this.makeLinearGradientForAreaChart(chart, idx, chartData.width) : null
              charts.push(<Shape
                  key={idx + 30000}
                  d={chartData.path}
                  stroke={chart.lineColor || DEFAULT_LINE_COLOR}
                  strokeWidth={0}
                  fill={fill} />);
            if (chart.hideLine) {
              // Make marker coords:
              markerCords = this.makeMarkersCoords(chart, width, this.state.t);
              chart.markerCords = markerCords;
              charts.push(this.makeMarkers(markerCords, idx));
              makeMarkers = false;
              break;
            }
          case 'spline':
            chartData = makeSplineChartPath(chart, width, this.state.t, this.minValue, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, false);
            this.maxScroll = 0 //Math.max(this.maxScroll, chartData.maxScroll || 0);
            charts.push(<Shape
                  key={idx + 10000}
                  d={chartData.path}
                  stroke={chart.lineColor || DEFAULT_LINE_COLOR}
                  strokeWidth={2}
                   />);
            // Make marker coords:
            if (makeMarkers) {
              markerCords = this.makeMarkersCoords(chart, width, this.state.t);
              chart.markerCords = markerCords;
              charts.push(this.makeMarkers(markerCords, idx));
            }
            break;
          case 'bars-range':
            rangeChart = true;
          case 'bars':
          chartData = makeBarsChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, PAD_LEFT, rangeChart);
            chart.barCords = chartData.barCords;
            this.maxScroll = Math.max(this.maxScroll, chartData.maxScroll || 0);
            charts.push(<Shape
                  key={idx + 20000}
                  d={chartData.path}
                  stroke={chart.lineColor || DEFAULT_LINE_COLOR}
                  strokeWidth={3}
                  fill={this.makeLinearGradientForAreaChart(chart, idx, chartData.width)} />);
                  break;
          case 'stacked-bars':
            chartData = makeStackedBarsChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, PAD_LEFT, this.props.yAxisLeft.width, true);
            chart.barCords = chartData.barCords;
            chartData.path.forEach((d, idx2) => {
              charts.push(<Shape key={idx2 + 20000}
                  d={d.path}
                  fill={d.color}
                  stroke="red"
                  strokeWidth={idx === this.state.activeMarker.chartIdx && idx2 === this.state.activeMarker.pointIdx ? 3 : 0} />);
            });
            break;
          case 'bars-3d':
            chartData = makeBars3DChartPath(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, PAD_LEFT, this.props.yAxisLeft ? this.props.yAxisLeft.width : 0, true);
            chart.barCords = chartData.barCords;
            chartData.path.forEach((d, idx2) => {
              let isActive = idx === this.state.activeMarker.chartIdx && d.pointIdx === this.state.activeMarker.pointIdx;
              charts.push(<Group key={idx2 + 290000} opacity={1}>
                <Shape
                  d={d.main}
                  fill={d.mainColor}
                  stroke={complement(d.mainColor)}
                  strokeWidth={isActive ? 5 : 0} />
                  <Shape
                  d={d.side}
                  fill={d.sideColor}
                  stroke={complement(d.sideColor)}
                  strokeWidth={isActive ? 5 : 0} />
                  <Shape
                  d={d.top}
                  fill={d.topColor}
                  stroke={complement(d.topColor)}
                  strokeWidth={isActive ? 5 : 0} />
                  </Group>
                  );
            });

            break;
          case 'candlestick':
          chartData = makeCandlestickChart(chart, width, this.state.t, this.maxValue, CHART_HEIGHT, CHART_HEIGHT_OFFSET, MARKER_RADIUS, this.pointsOnScreen, PAD_LEFT);
          chart.barCords = chartData.barCords;
          chartData.paths.forEach((d, idx2) => {
            charts.push(<Shape
                  key={idx2 + 80000}
                  d={d.pathStr}
                  stroke={chart.lineColor}
                  strokeWidth={idx === this.state.activeMarker.chartIdx && idx2 === this.state.activeMarker.pointIdx ? 3 : 1}
                  fill={d.openHigherThanClose ? chart.fillDown : chart.fillUp} />);
          });
       }
       return charts;
     });


    return (
      <View>
        <View style={[styles.container, {
          transform: [{translateX: this.state.trX}],
          width: width
        }, this.props.style]}
        ref="chart" >
          <Surface width={this.maxScroll + width} height={CHART_HEIGHT+CHART_HEIGHT/2}
            style={styles.chartSurface}>
            {charts}
            <Shape d={makeCircle(this.state.clickFeedback.x, this.state.clickFeedback.y, this.state.clickFeedback.r)} fill={`rgba(255,255,255, ${this.state.clickFeedback.o})`} />
          </Surface>
        </View>
        <View {...this._panResponder.panHandlers} style={styles.axesContainer}>
          <Surface width={this.maxScroll + width} height={CHART_HEIGHT+CHART_HEIGHT/2}
          style={styles.chartSurface}>
           {this.yAxis}
        </Surface>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  chartSurface: {
    backgroundColor: 'rgba(0,0,0,0)',
    overflow: 'visible',
    marginTop: -CHART_HEIGHT/2,
    //backgroundColor: 'rgba(0,0,0,.2)'
  },
  axesContainer: {
    position: 'absolute',
    top: 10,
    left: 0
  }
});

export default ArtyCharty;
