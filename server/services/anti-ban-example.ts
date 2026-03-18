import { antiBanIntegration } from './anti-ban-integration';

/**
 * مثال عملي لاستخدام نظام الحماية من الحظر
 * يوضح كيفية استخدام جميع المكونات معاً
 */
export class AntiBanExample {
  
  /**
   * مثال: إرسال رسالة مع حماية كاملة
   */
  async sendMessageWithProtection(accountId: number, targetUserId: string, message: string): Promise<boolean> {
    try {
      console.log(`🚀 Starting protected message operation for account ${accountId}`);

      // 1. التحقق قبل العملية
      const approval = await antiBanIntegration.preOperationCheck(accountId, {
        type: 'message',
        targetCount: 1,
        speed: 'medium',
        targetInfo: { userId: targetUserId },
        accountAge: 30,
        systemLoad: 0.3
      });

      if (!approval.approved) {
        console.log(`❌ Operation rejected: ${approval.reason}`);
        console.log(`📋 Recommendations: ${approval.recommendations?.join(', ')}`);
        
        if (approval.retryAfter) {
          const waitTime = Math.round((approval.retryAfter.getTime() - Date.now()) / 1000 / 60);
          console.log(`⏰ Retry after ${waitTime} minutes`);
        }
        
        return false;
      }

      console.log(`✅ Operation approved with confidence: ${(approval.confidence! * 100).toFixed(1)}%`);
      console.log(`⏱️  Recommended delay: ${approval.delay}ms`);
      console.log(`🔒 Risk level: ${approval.riskLevel}`);
      
      if (approval.proxy) {
        console.log(`🌐 Using proxy: ${approval.proxy.host}:${approval.proxy.port}`);
      }

      // 2. الانتظار الذكي
      if (approval.delay && approval.delay > 0) {
        console.log(`⏳ Waiting ${approval.delay}ms before operation...`);
        await this.sleep(approval.delay);
      }

      // 3. تنفيذ العملية الفعلية (محاكاة)
      console.log(`📤 Sending message to user ${targetUserId}...`);
      const startTime = Date.now();
      
      const result = await this.simulateSendMessage(targetUserId, message, approval.proxy);
      
      const duration = Date.now() - startTime;
      
      // 4. تسجيل النتيجة
      await antiBanIntegration.recordOperationResult(accountId, {
        type: 'message',
        targetCount: 1,
        speed: 'medium'
      }, {
        success: result.success,
        duration,
        actualDelay: approval.delay,
        responseTime: result.responseTime,
        proxyUsed: approval.proxy?.id,
        errorType: result.errorType,
        errorMessage: result.errorMessage
      });

      if (result.success) {
        console.log(`✅ Message sent successfully in ${duration}ms`);
        return true;
      } else {
        console.log(`❌ Message failed: ${result.errorMessage}`);
        return false;
      }

    } catch (error) {
      console.error(`💥 System error during operation:`, error);
      return false;
    }
  }

  /**
   * مثال: عملية جماعية مع حماية متقدمة
   */
  async bulkOperationWithProtection(accountId: number, targets: string[], operationType: 'message' | 'add_user'): Promise<void> {
    console.log(`🚀 Starting bulk ${operationType} operation for ${targets.length} targets`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      console.log(`\n📍 Processing target ${i + 1}/${targets.length}: ${target}`);
      
      // التحقق قبل كل عملية
      const approval = await antiBanIntegration.preOperationCheck(accountId, {
        type: operationType,
        targetCount: targets.length,
        speed: i === 0 ? 'slow' : 'medium', // أول عملية أبطأ
        targetInfo: { target },
        consecutiveFailures: failureCount,
        accountAge: 30
      });

      if (!approval.approved) {
        console.log(`❌ Operation stopped: ${approval.reason}`);
        console.log(`📊 Progress: ${successCount} success, ${failureCount} failures`);
        break;
      }

      // الانتظار الذكي
      if (approval.delay && approval.delay > 0) {
        await this.sleep(approval.delay);
      }

      // التنفيذ
      const result = operationType === 'message' 
        ? await this.simulateSendMessage(target, "Hello!", approval.proxy)
        : await this.simulateAddUser(target, approval.proxy);

      // تسجيل النتيجة
      await antiBanIntegration.recordOperationResult(accountId, {
        type: operationType,
        targetCount: targets.length,
        speed: 'medium'
      }, {
        success: result.success,
        duration: result.responseTime || 0,
        actualDelay: approval.delay,
        responseTime: result.responseTime,
        proxyUsed: approval.proxy?.id,
        errorType: result.errorType,
        errorMessage: result.errorMessage
      });

      if (result.success) {
        successCount++;
        console.log(`✅ Target ${target} processed successfully`);
      } else {
        failureCount++;
        console.log(`❌ Target ${target} failed: ${result.errorMessage}`);
      }

      // عرض المراقبة
      if (approval.monitoring) {
        console.log(`📊 Monitoring - Risk: ${approval.monitoring.riskScore.toFixed(1)}, Proxy: ${approval.monitoring.proxyHealth}, Delay: ${(approval.monitoring.delayQuality * 100).toFixed(1)}%`);
      }
    }

    console.log(`\n📈 Bulk operation completed:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failures: ${failureCount}`);
    console.log(`📊 Success rate: ${((successCount / targets.length) * 100).toFixed(1)}%`);
  }

  /**
   * مثال: مراقبة حالة الحساب
   */
  async monitorAccountHealth(accountId: number): Promise<void> {
    console.log(`🔍 Checking account health for account ${accountId}`);
    
    const status = await antiBanIntegration.getAccountStatus(accountId);
    
    if (!status) {
      console.log(`❌ Unable to get account status`);
      return;
    }

    console.log(`\n📊 Account Health Report:`);
    console.log(`🏥 Overall Health Score: ${status.healthScore}/100`);
    
    if (status.status) {
      console.log(`💚 Account Healthy: ${status.status.isHealthy ? 'Yes' : 'No'}`);
      console.log(`🔄 Can Operate: ${status.status.canOperate ? 'Yes' : 'No'}`);
      
      if (status.status.health) {
        console.log(`📈 Account Score: ${status.status.health.score}/100`);
        console.log(`⚠️  Risk Level: ${status.status.health.riskLevel}`);
        console.log(`🔥 Consecutive Failures: ${status.status.health.consecutiveFailures}`);
        console.log(`📊 Total Operations: ${status.status.health.totalOperations}`);
      }
    }

    if (status.delayStatistics) {
      console.log(`\n⏱️  Delay Statistics:`);
      console.log(`📊 Average Delay: ${status.delayStatistics.averageDelay}ms`);
      console.log(`🎯 Consistency Score: ${(status.delayStatistics.consistencyScore * 100).toFixed(1)}%`);
      console.log(`✅ Success Rate: ${(status.delayStatistics.averageSuccessRate * 100).toFixed(1)}%`);
    }

    if (status.proxyStatistics) {
      console.log(`\n🌐 Proxy Statistics:`);
      console.log(`📊 Total Proxies: ${status.proxyStatistics.totalProxies}`);
      console.log(`💚 Healthy Proxies: ${status.proxyStatistics.healthyProxies}`);
      console.log(`📈 Health Percentage: ${status.proxyStatistics.healthPercentage.toFixed(1)}%`);
      console.log(`⏱️  Average Response Time: ${status.proxyStatistics.averageResponseTime}ms`);
      console.log(`🔄 Rotation Strategy: ${status.proxyStatistics.rotationStrategy}`);
    }

    console.log(`\n💡 Recommendations:`);
    status.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });

    console.log(`\n🕐 Last Updated: ${status.lastUpdated.toISOString()}`);
  }

  /**
   * مثال: إحصائيات النظام
   */
  async showSystemStatistics(): Promise<void> {
    console.log(`📊 System Statistics:`);
    
    const stats = await antiBanIntegration.getSystemStatistics();
    
    console.log(`👥 Total Accounts: ${stats.totalAccounts}`);
    console.log(`💚 Healthy Accounts: ${stats.healthyAccounts}`);
    console.log(`⚠️  Average Risk Score: ${stats.averageRiskScore.toFixed(1)}/100`);
    console.log(`🌐 Total Proxies: ${stats.totalProxies}`);
    console.log(`💚 Healthy Proxies: ${stats.healthyProxies}`);
    console.log(`⏱️  Average Delay: ${stats.averageDelay}ms`);
    console.log(`🖥️  System Load: ${(stats.systemLoad * 100).toFixed(1)}%`);
    console.log(`🕐 Last Updated: ${stats.lastUpdated.toISOString()}`);
  }

  /**
   * محاكاة إرسال رسالة
   */
  private async simulateSendMessage(userId: string, message: string, proxy?: any): Promise<any> {
    // محاكاة تأخير الشبكة
    const responseTime = 500 + Math.random() * 2000; // 0.5-2.5 ثانية
    
    await this.sleep(responseTime);
    
    // محاكاة نجاح/فشل (90% نجاح)
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        responseTime
      };
    } else {
      const errors = ['FLOOD_WAIT', 'USER_NOT_FOUND', 'CHAT_RESTRICTED', 'NETWORK_ERROR'];
      const errorType = errors[Math.floor(Math.random() * errors.length)];
      
      return {
        success: false,
        errorType,
        errorMessage: `Simulated ${errorType} error`,
        responseTime
      };
    }
  }

  /**
   * محاكاة إضافة مستخدم
   */
  private async simulateAddUser(userId: string, proxy?: any): Promise<any> {
    const responseTime = 1000 + Math.random() * 3000; // 1-4 ثواني
    
    await this.sleep(responseTime);
    
    // محاكاة نجاح/فشل (85% نجاح)
    const success = Math.random() > 0.15;
    
    if (success) {
      return {
        success: true,
        responseTime
      };
    } else {
      const errors = ['USER_ALREADY_IN_CHAT', 'USER_NOT_FOUND', 'PEER_FLOOD', 'PRIVACY_RESTRICTED'];
      const errorType = errors[Math.floor(Math.random() * errors.length)];
      
      return {
        success: false,
        errorType,
        errorMessage: `Simulated ${errorType} error`,
        responseTime
      };
    }
  }

  /**
   * دالة مساعدة للانتظار
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// مثال الاستخدام
export async function runAntiBanExample() {
  const example = new AntiBanExample();
  
  console.log('🚀 Starting Anti-Ban System Example\n');
  
  // 1. مراقبة حالة الحساب
  await example.monitorAccountHealth(123);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. إرسال رسالة واحدة
  await example.sendMessageWithProtection(123, 'user123', 'Hello from protected system!');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. عملية جماعية
  const targets = ['user1', 'user2', 'user3', 'user4', 'user5'];
  await example.bulkOperationWithProtection(123, targets, 'message');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 4. إحصائيات النظام
  await example.showSystemStatistics();
  
  console.log('\n✅ Example completed!');
}
