declare module 'react-native-chart-kit' {
    import { Component } from 'react';
    export class LineChart extends Component<any> { }
    export class BarChart extends Component<any> { }
    export class PieChart extends Component<any> { }
    export class ProgressChart extends Component<any> { }
    export class ContributionGraph extends Component<any> { }
    export class StackedBarChart extends Component<any> { }
}

declare module '@expo/vector-icons/Ionicons' {
    import { Icon } from '@expo/vector-icons/build/createIconSet';
    const Ionicons: Icon<string, string>;
    export default Ionicons;
}
