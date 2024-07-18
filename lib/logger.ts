class Logger {
  getNow() {
    const date = new Date();
    const [hour, minutes, seconds] = [date.getHours(), date.getMinutes(), date.getSeconds()];

    return `${hour < 10 ? '0' + hour : hour}:${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  }

  logError(message: string, error?: any) {
    console.error(`[ERROR]:${this.getNow()} ${message}`, error);
  }

  logInfo(message: string, data?: any) {
    if (data) {
      console.log(`[INFO]:${this.getNow()} ${message}`, data);
    } else {
      console.log(`[INFO]:${this.getNow()} ${message}`);
    }
  }

  logWarning(message: string, event?: any) {
    console.warn(`[WARNING]:${this.getNow()} ${message}`, event);
  }
}

export const logger = new Logger();
