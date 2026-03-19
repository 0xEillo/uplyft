      case 21: {
        const handleToggleDeprioritize = (muscleId: string) => {
          setDeprioritizedMuscles((prev) => {
            if (prev.includes(muscleId)) {
              return prev.filter((id) => id !== muscleId)
            }
            if (prev.length < 5) {
              return [...prev, muscleId]
            }
            return prev
          })
        }

        const upperMuscles = ONBOARDING_MUSCLES.filter((m) => m.bodyHalf === 'upper')
        const lowerMuscles = ONBOARDING_MUSCLES.filter((m) => m.bodyHalf === 'lower')

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                Would you like to deprioritize any specific muscles?
              </Text>
            </View>

            <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 12 }]}>Upper</Text>
              <View style={styles.muscleGrid}>
                {upperMuscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.id}
                    style={styles.muscleGridItem}
                    onPress={() => handleToggleDeprioritize(muscle.id)}
                  >
                    <View style={[styles.muscleGridItemInner, deprioritizedMuscles.includes(muscle.id) && styles.muscleGridItemSelected]}>
                      <View style={styles.muscleBodyContainer}>
                        <View
                          style={[
                            styles.muscleBodyWrapper,
                            { transform: [{ translateY: BODY_HALF_CONFIG.upper.offsetY }] },
                          ]}
                        >
                          <Body
                            data={[{ slug: muscle.slug, intensity: 1 }]}
                            gender={data.gender === 'female' ? 'female' : 'male'}
                            side={muscle.side}
                            scale={BODY_HALF_CONFIG.upper.scale}
                            colors={['#3B82F6']}
                            border="#D1D5DB"
                          />
                        </View>
                      </View>
                      <Text style={styles.muscleGridItemLabel}>{muscle.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Lower</Text>
              <View style={styles.muscleGrid}>
                {lowerMuscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.id}
                    style={styles.muscleGridItem}
                    onPress={() => handleToggleDeprioritize(muscle.id)}
                  >
                    <View style={[styles.muscleGridItemInner, deprioritizedMuscles.includes(muscle.id) && styles.muscleGridItemSelected]}>
                      <View style={styles.muscleBodyContainer}>
                        <View
                          style={[
                            styles.muscleBodyWrapper,
                            { transform: [{ translateY: BODY_HALF_CONFIG.lower.offsetY }] },
                          ]}
                        >
                          <Body
                            data={[{ slug: muscle.slug, intensity: 1 }]}
                            gender={data.gender === 'female' ? 'female' : 'male'}
                            side={muscle.side}
                            scale={BODY_HALF_CONFIG.lower.scale}
                            colors={['#3B82F6']}
                            border="#D1D5DB"
                          />
                        </View>
                      </View>
                      <Text style={styles.muscleGridItemLabel}>{muscle.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        )
      }
      case 22: {
        const totalFocusPoints = Object.values(focusPoints).reduce((sum, val) => sum + val, 0)

        const handleUpdateFocus = (muscleId: string, increment: boolean) => {
          setFocusPoints((prev) => {
            const current = prev[muscleId] || 0
            if (increment) {
              if (totalFocusPoints < 5) {
                return { ...prev, [muscleId]: current + 1 }
              }
            } else {
              if (current > 0) {
                const updated = { ...prev, [muscleId]: current - 1 }
                if (updated[muscleId] === 0) delete updated[muscleId]
                return updated
              }
            }
            return prev
          })
        }

        const upperMuscles = ONBOARDING_MUSCLES.filter((m) => m.bodyHalf === 'upper')
        const lowerMuscles = ONBOARDING_MUSCLES.filter((m) => m.bodyHalf === 'lower')

        const renderMuscleListItem = (muscle: typeof ONBOARDING_MUSCLES[number]) => {
          const points = focusPoints[muscle.id] || 0
          return (
            <View key={muscle.id} style={styles.muscleListItem}>
              <View style={styles.muscleListItemBody}>
                <View
                  style={[
                    styles.muscleBodyWrapper,
                    { transform: [{ translateY: BODY_HALF_CONFIG[muscle.bodyHalf].offsetY }] },
                  ]}
                >
                  <Body
                    data={[{ slug: muscle.slug, intensity: 1 }]}
                    gender={data.gender === 'female' ? 'female' : 'male'}
                    side={muscle.side}
                    scale={BODY_HALF_CONFIG[muscle.bodyHalf].scale}
                    colors={['#3B82F6']}
                    border="#D1D5DB"
                  />
                </View>
              </View>
              <Text style={styles.muscleListItemLabel}>{muscle.label}</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => handleUpdateFocus(muscle.id, false)}
                >
                  <Ionicons name="remove" size={20} color={points > 0 ? colors.textPrimary : colors.textTertiary} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{points}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => handleUpdateFocus(muscle.id, true)}
                >
                  <Ionicons name="add" size={20} color={totalFocusPoints < 5 ? colors.textPrimary : colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          )
        }

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                Would you like to give extra focus to any muscles?
              </Text>
            </View>

            <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Upper</Text>
              <View style={styles.muscleList}>
                {upperMuscles.map(renderMuscleListItem)}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 8 }]}>Lower</Text>
              <View style={styles.muscleList}>
                {lowerMuscles.map(renderMuscleListItem)}
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        )
      }