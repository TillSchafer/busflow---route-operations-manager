class StopEdit {
  const StopEdit({
    this.actualArrivalTime,
    this.actualDepartureTime,
    this.boarding,
    this.leaving,
    this.currentTotal,
  });

  final String? actualArrivalTime;
  final String? actualDepartureTime;
  final int? boarding;
  final int? leaving;
  final int? currentTotal;

  bool get isEmpty =>
      actualArrivalTime == null &&
      actualDepartureTime == null &&
      boarding == null &&
      leaving == null &&
      currentTotal == null;

  StopEdit copyWith({
    String? actualArrivalTime,
    String? actualDepartureTime,
    int? boarding,
    int? leaving,
    int? currentTotal,
  }) {
    return StopEdit(
      actualArrivalTime: actualArrivalTime ?? this.actualArrivalTime,
      actualDepartureTime: actualDepartureTime ?? this.actualDepartureTime,
      boarding: boarding ?? this.boarding,
      leaving: leaving ?? this.leaving,
      currentTotal: currentTotal ?? this.currentTotal,
    );
  }
}
