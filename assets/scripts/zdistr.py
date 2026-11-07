# -*- coding:utf-8 -*-

"""
@author: Jin-Cheng Liu
@file: masscenter
@time: 2/19/2017 10:03 PM
"""

import sys, math, linecache, time
import numpy as np


def atom_to_center_time():
    with open(fileName,'r') as f:
        lines = f.readlines()
        print('total lines of colored file:',len(lines))
    distance = []
    for i in range(0, loop_N):
        coord1_sum = [0, 0, 0]
        count_Au = 0
        for j in range(0, int(atomNum) + 2):
            tmpl = lines[i * (int(atomNum) + 2) + j].split(' ')
            while '' in tmpl:
                tmpl.remove('')
            if tmpl[0] == AtomName:
                count_Au += 1
                distance.append(str(tmpl[3]))

    # print(distance)

    list2str = ''.join(distance)
    open(outfile, 'w').write(list2str)
    print('The distance \
     are written to distance.txt')


print('#######  START  #######')
#fileName = 'newpos-CeO2.xyz'       # input filename
fileName = sys.argv[1]
AtomName = sys.argv[2]

atomNum = (linecache.getline(fileName,1)).strip()
print('total atom number:', atomNum)

#count the iteration number
with open(fileName,'r') as f:
    lines = f.readlines()
    print('total lines:',len(lines))

loop_N = ( len(lines) // (int(atomNum)+2) )
print('iteration number:',loop_N)

outfile = "distance-" + AtomName + ".xyz"
atom_to_center_time()